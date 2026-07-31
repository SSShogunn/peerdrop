// Package peerdropcore ties the signaling client and pion/webrtc together
// to establish the same offerer/answerer flow as
// client/src/context/PeerContext.tsx (startWebRTC / handleOffer), and hosts
// the "fileTransfer" RTCDataChannel used by the transfer engine.
package peerdropcore

import (
	"context"
	"fmt"

	"github.com/pion/webrtc/v4"

	"github.com/SSShogunn/peerdrop/native/peerdrop-core/protocol"
	"github.com/SSShogunn/peerdrop/native/peerdrop-core/signaling"
)

const dataChannelLabel = "fileTransfer"

// Role mirrors PeerRole in client/src/types/index.ts.
type Role string

const (
	RoleOfferer  Role = "offerer"
	RoleAnswerer Role = "answerer"
)

type Session struct {
	sig  *signaling.Client
	pc   *webrtc.PeerConnection
	role Role

	dc *webrtc.DataChannel

	OnDataChannelOpen  func(*webrtc.DataChannel)
	OnPeerDisconnected func()
	OnError            func(error)
}

func NewSession(sig *signaling.Client, iceServers []webrtc.ICEServer) (*Session, error) {
	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{ICEServers: iceServers})
	if err != nil {
		return nil, fmt.Errorf("peer: new peer connection: %w", err)
	}

	s := &Session{sig: sig, pc: pc}

	pc.OnICECandidate(func(c *webrtc.ICECandidate) {
		if c == nil {
			return
		}
		init := c.ToJSON()
		var mLineIndex *uint16
		if init.SDPMLineIndex != nil {
			v := *init.SDPMLineIndex
			mLineIndex = &v
		}
		_ = sig.Send(protocol.ICEMsg{
			Type: "ice",
			Candidate: protocol.ICECandidate{
				Candidate:        init.Candidate,
				SDPMid:           init.SDPMid,
				SDPMLineIndex:    mLineIndex,
				UsernameFragment: init.UsernameFragment,
			},
		})
	})

	pc.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		if state == webrtc.PeerConnectionStateFailed || state == webrtc.PeerConnectionStateDisconnected {
			if s.OnPeerDisconnected != nil {
				s.OnPeerDisconnected()
			}
		}
	})

	sig.On("answer", func(raw []byte) { s.handleAnswer(raw) })
	sig.On("ice", func(raw []byte) { s.handleRemoteICE(raw) })
	sig.On("peer_disconnected", func(raw []byte) {
		if s.OnPeerDisconnected != nil {
			s.OnPeerDisconnected()
		}
	})

	return s, nil
}

func (s *Session) StartOffer(ctx context.Context) error {
	s.role = RoleOfferer

	ordered := true
	dc, err := s.pc.CreateDataChannel(dataChannelLabel, &webrtc.DataChannelInit{Ordered: &ordered})
	if err != nil {
		return fmt.Errorf("peer: create data channel: %w", err)
	}
	s.attachDataChannel(dc)

	offer, err := s.pc.CreateOffer(nil)
	if err != nil {
		return fmt.Errorf("peer: create offer: %w", err)
	}
	if err := s.pc.SetLocalDescription(offer); err != nil {
		return fmt.Errorf("peer: set local description: %w", err)
	}

	return s.sig.Send(protocol.OfferMsg{Type: "offer", SDP: offer.SDP})
}

func (s *Session) HandleOffer(raw []byte) error {
	s.role = RoleAnswerer

	var msg protocol.OfferMsg
	if err := unmarshal(raw, &msg); err != nil {
		return err
	}

	s.pc.OnDataChannel(func(dc *webrtc.DataChannel) {
		s.attachDataChannel(dc)
	})

	if err := s.pc.SetRemoteDescription(webrtc.SessionDescription{
		Type: webrtc.SDPTypeOffer,
		SDP:  msg.SDP,
	}); err != nil {
		return fmt.Errorf("peer: set remote description: %w", err)
	}

	answer, err := s.pc.CreateAnswer(nil)
	if err != nil {
		return fmt.Errorf("peer: create answer: %w", err)
	}
	if err := s.pc.SetLocalDescription(answer); err != nil {
		return fmt.Errorf("peer: set local description: %w", err)
	}

	return s.sig.Send(protocol.AnswerMsg{Type: "answer", SDP: answer.SDP})
}

func (s *Session) handleAnswer(raw []byte) {
	var msg protocol.AnswerMsg
	if err := unmarshal(raw, &msg); err != nil {
		s.reportErr(err)
		return
	}
	if err := s.pc.SetRemoteDescription(webrtc.SessionDescription{
		Type: webrtc.SDPTypeAnswer,
		SDP:  msg.SDP,
	}); err != nil {
		s.reportErr(fmt.Errorf("peer: set remote description (answer): %w", err))
	}
}

func (s *Session) handleRemoteICE(raw []byte) {
	var msg protocol.ICEMsg
	if err := unmarshal(raw, &msg); err != nil {
		s.reportErr(err)
		return
	}
	candidate := webrtc.ICECandidateInit{
		Candidate:        msg.Candidate.Candidate,
		SDPMid:           msg.Candidate.SDPMid,
		SDPMLineIndex:    msg.Candidate.SDPMLineIndex,
		UsernameFragment: msg.Candidate.UsernameFragment,
	}
	if err := s.pc.AddICECandidate(candidate); err != nil {
		s.reportErr(fmt.Errorf("peer: add ice candidate: %w", err))
	}
}

func (s *Session) attachDataChannel(dc *webrtc.DataChannel) {
	s.dc = dc
	dc.OnOpen(func() {
		if s.OnDataChannelOpen != nil {
			s.OnDataChannelOpen(dc)
		}
	})
}

func (s *Session) reportErr(err error) {
	if s.OnError != nil {
		s.OnError(err)
	}
}

func (s *Session) Close() error {
	return s.pc.Close()
}
