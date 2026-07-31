// Package protocol defines the JSON wire types shared with the browser
// client (client/src/types/index.ts). Field names/casing must match exactly
// since the signaling server relays messages opaquely and browser peers
// parse these messages directly.
package protocol

import "encoding/json"

// Signaling messages, exchanged over the WebSocket connection to the
// signaling server (server/main.py).

type SignalingEnvelope struct {
	Type string `json:"type"`
}

type CreateRoomMsg struct {
	Type string `json:"type"` // "create_room"
}

type JoinRoomMsg struct {
	Type string `json:"type"` // "join_room"
	Code string `json:"code"`
}

type RoomCreatedMsg struct {
	Type string `json:"type"` // "room_created"
	Code string `json:"code"`
}

type ErrorMsg struct {
	Type    string `json:"type"` // "error"
	Message string `json:"message"`
}

type OfferMsg struct {
	Type       string `json:"type"` // "offer"
	SDP        string `json:"sdp"`
	ICERestart bool   `json:"iceRestart,omitempty"`
}

type AnswerMsg struct {
	Type string `json:"type"` // "answer"
	SDP  string `json:"sdp"`
}

// ICECandidate mirrors the browser's RTCIceCandidateInit shape.
type ICECandidate struct {
	Candidate        string  `json:"candidate"`
	SDPMid           *string `json:"sdpMid,omitempty"`
	SDPMLineIndex    *uint16 `json:"sdpMLineIndex,omitempty"`
	UsernameFragment *string `json:"usernameFragment,omitempty"`
}

type ICEMsg struct {
	Type      string       `json:"type"` // "ice"
	Candidate ICECandidate `json:"candidate"`
}

// Data-channel control messages, exchanged as JSON text frames over the
// "fileTransfer" RTCDataChannel. Raw binary frames carry chunk bytes and are
// not represented here.

type FileSummary struct {
	ID             string `json:"id"`
	FileName       string `json:"fileName"`
	FileSize       int64  `json:"fileSize"`
	FileType       string `json:"fileType"`
	PreviewDataURL string `json:"previewDataUrl,omitempty"`
}

type TransferRequest struct {
	Type    string        `json:"type"` // "request"
	BatchID string        `json:"batchId"`
	Files   []FileSummary `json:"files"`
}

type TransferAccept struct {
	Type    string `json:"type"` // "accept"
	BatchID string `json:"batchId"`
}

type TransferDecline struct {
	Type    string `json:"type"` // "decline"
	BatchID string `json:"batchId"`
}

type TransferMeta struct {
	Type          string `json:"type"` // "meta"
	ID            string `json:"id"`
	FileName      string `json:"fileName"`
	FileSize      int64  `json:"fileSize"`
	FileType      string `json:"fileType"`
	TotalChunks   int    `json:"totalChunks"`
	IsLastInQueue bool   `json:"isLastInQueue"`
}

type TransferComplete struct {
	Type     string `json:"type"` // "complete"
	ID       string `json:"id"`
	Checksum string `json:"checksum"`
}

type TransferAck struct {
	Type string `json:"type"` // "ack"
	ID   string `json:"id"`
	OK   bool   `json:"ok"`
}

type TransferCancel struct {
	Type string `json:"type"` // "cancel"
	ID   string `json:"id"`
}

type TextMessage struct {
	Type string `json:"type"` // "text"
	ID   string `json:"id"`
	Text string `json:"text"`
}

const MaxTextLength = 10_000

func DataChannelType(raw []byte) (string, error) {
	var env SignalingEnvelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return "", err
	}
	return env.Type, nil
}
