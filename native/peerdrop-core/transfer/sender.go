// Package transfer implements the file-transfer protocol carried over the
// "fileTransfer" RTCDataChannel, mirroring the sender/receiver logic in
// client/src/context/PeerContext.tsx (queueFiles/processQueue/sendNextChunk
// and handleMeta/handleChunk/finalizeReceive).
package transfer

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"github.com/pion/webrtc/v4"

	"github.com/SSShogunn/peerdrop/native/peerdrop-core/protocol"
)

// DefaultChunkSize matches the browser client's default VITE_CHUNK_SIZE
// (16KB).
const DefaultChunkSize = 16 * 1024

// bufferedAmountHighWater/LowWater mirror PeerContext.tsx's backpressure
// thresholds (CHUNK_SIZE*8 pause / CHUNK_SIZE*4 resume).
const (
	bufferedHighWaterMultiplier = 8
	bufferedLowWaterMultiplier  = 4
)

// SendProgress reports incremental progress for the file currently being
// sent.
type SendProgress struct {
	FileName   string
	BytesSent  int64
	TotalBytes int64
}

type Sender struct {
	dc        *webrtc.DataChannel
	chunkSize int
	batchID   string

	accept chan bool
	ack    chan protocol.TransferAck
}

func NewSender(dc *webrtc.DataChannel, chunkSize int) *Sender {
	if chunkSize <= 0 {
		chunkSize = DefaultChunkSize
	}
	s := &Sender{
		dc:        dc,
		chunkSize: chunkSize,
		accept:    make(chan bool, 1),
		ack:       make(chan protocol.TransferAck, 1),
	}
	dc.OnMessage(s.onMessage)
	return s
}

func (s *Sender) onMessage(msg webrtc.DataChannelMessage) {
	if !msg.IsString {
		return
	}
	typ, err := protocol.DataChannelType(msg.Data)
	if err != nil {
		return
	}
	switch typ {
	case "accept":
		var m protocol.TransferAccept
		if json.Unmarshal(msg.Data, &m) == nil && m.BatchID == s.batchID {
			s.accept <- true
		}
	case "decline":
		var m protocol.TransferDecline
		if json.Unmarshal(msg.Data, &m) == nil && m.BatchID == s.batchID {
			s.accept <- false
		}
	case "ack":
		var m protocol.TransferAck
		if json.Unmarshal(msg.Data, &m) == nil {
			s.ack <- m
		}
	}
}

func (s *Sender) SendFiles(ctx context.Context, paths []string, onProgress func(SendProgress)) error {
	if len(paths) == 0 {
		return fmt.Errorf("transfer: no files to send")
	}

	s.batchID = uuid.NewString()
	fileIDs := make([]string, len(paths))
	files := make([]protocol.FileSummary, len(paths))
	sizes := make([]int64, len(paths))

	for i, p := range paths {
		info, err := os.Stat(p)
		if err != nil {
			return fmt.Errorf("transfer: stat %s: %w", p, err)
		}
		if info.IsDir() {
			return fmt.Errorf("transfer: %s is a directory", p)
		}
		fileIDs[i] = uuid.NewString()
		sizes[i] = info.Size()
		files[i] = protocol.FileSummary{
			ID:       fileIDs[i],
			FileName: filepath.Base(p),
			FileSize: info.Size(),
			FileType: guessMimeType(p),
		}
	}

	req := protocol.TransferRequest{Type: "request", BatchID: s.batchID, Files: files}
	if err := s.sendJSON(req); err != nil {
		return err
	}

	select {
	case ok := <-s.accept:
		if !ok {
			return fmt.Errorf("transfer: receiver declined the transfer")
		}
	case <-ctx.Done():
		return ctx.Err()
	}

	for i, p := range paths {
		isLast := i == len(paths)-1
		if err := s.sendFile(ctx, p, fileIDs[i], sizes[i], files[i].FileType, isLast, onProgress); err != nil {
			return fmt.Errorf("transfer: sending %s: %w", p, err)
		}
	}
	return nil
}

func (s *Sender) sendFile(ctx context.Context, path, id string, size int64, fileType string, isLast bool, onProgress func(SendProgress)) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()

	totalChunks := int((size + int64(s.chunkSize) - 1) / int64(s.chunkSize))
	if size == 0 {
		totalChunks = 0
	}

	meta := protocol.TransferMeta{
		Type:          "meta",
		ID:            id,
		FileName:      filepath.Base(path),
		FileSize:      size,
		FileType:      fileType,
		TotalChunks:   totalChunks,
		IsLastInQueue: isLast,
	}
	if err := s.sendJSON(meta); err != nil {
		return err
	}

	hasher := sha256.New()
	buf := make([]byte, s.chunkSize)
	var sent int64

	for {
		n, readErr := f.Read(buf)
		if n > 0 {
			chunk := buf[:n]
			hasher.Write(chunk)

			if err := s.waitForBufferSpace(ctx); err != nil {
				return err
			}
			if err := s.dc.Send(chunk); err != nil {
				return fmt.Errorf("send chunk: %w", err)
			}

			sent += int64(n)
			if onProgress != nil {
				onProgress(SendProgress{FileName: filepath.Base(path), BytesSent: sent, TotalBytes: size})
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return readErr
		}
	}

	checksum := hex.EncodeToString(hasher.Sum(nil))
	complete := protocol.TransferComplete{Type: "complete", ID: id, Checksum: checksum}
	if err := s.sendJSON(complete); err != nil {
		return err
	}

	select {
	case ack := <-s.ack:
		if ack.ID != id || !ack.OK {
			return fmt.Errorf("receiver reported a checksum mismatch")
		}
	case <-ctx.Done():
		return ctx.Err()
	}
	return nil
}

func (s *Sender) waitForBufferSpace(ctx context.Context) error {
	high := uint64(s.chunkSize * bufferedHighWaterMultiplier)
	for s.dc.BufferedAmount() > high {
		select {
		case <-time.After(10 * time.Millisecond):
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return nil
}

func (s *Sender) Cancel(id string) error {
	return s.sendJSON(protocol.TransferCancel{Type: "cancel", ID: id})
}

func (s *Sender) SendText(text string) error {
	if len(text) > protocol.MaxTextLength {
		return fmt.Errorf("transfer: text exceeds max length of %d", protocol.MaxTextLength)
	}
	return s.sendJSON(protocol.TextMessage{Type: "text", ID: uuid.NewString(), Text: text})
}

func (s *Sender) sendJSON(v any) error {
	raw, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return s.dc.SendText(string(raw))
}

func guessMimeType(path string) string {
	ext := filepath.Ext(path)
	if t := mime.TypeByExtension(ext); t != "" {
		return t
	}
	return "application/octet-stream"
}
