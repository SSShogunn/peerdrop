package transfer

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"hash"
	"os"
	"path/filepath"

	"github.com/pion/webrtc/v4"

	"github.com/SSShogunn/peerdrop/native/peerdrop-core/protocol"
)

type RecvProgress struct {
	FileName      string
	BytesReceived int64
	TotalBytes    int64
}

type Receiver struct {
	dc     *webrtc.DataChannel
	outDir string

	// OnRequest is called when a batch of files is offered; return true to
	// accept, false to decline. If nil, all requests are accepted.
	OnRequest func(batchID string, files []protocol.FileSummary) bool
	// OnProgress is called as chunks arrive for the current file. May be nil.
	OnProgress func(RecvProgress)
	// OnFileReceived is called once a file is written and verified.
	OnFileReceived func(fileName string, savedPath string)
	// OnText is called when a text/link message arrives.
	OnText func(text string)

	remaining int
	curFile   *os.File
	curHasher hash.Hash
	curMeta   protocol.TransferMeta
	received  int64

	done chan error
}

func NewReceiver(dc *webrtc.DataChannel, outDir string) *Receiver {
	r := &Receiver{
		dc:     dc,
		outDir: outDir,
		done:   make(chan error, 1),
	}
	dc.OnMessage(r.onMessage)
	return r
}

func (r *Receiver) Wait(ctx context.Context) error {
	select {
	case err := <-r.done:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (r *Receiver) onMessage(msg webrtc.DataChannelMessage) {
	if !msg.IsString {
		r.handleChunk(msg.Data)
		return
	}

	typ, err := protocol.DataChannelType(msg.Data)
	if err != nil {
		return
	}

	switch typ {
	case "request":
		r.handleRequest(msg.Data)
	case "meta":
		r.handleMeta(msg.Data)
	case "complete":
		r.handleComplete(msg.Data)
	case "cancel":
		r.handleCancel(msg.Data)
	case "text":
		var m protocol.TextMessage
		if json.Unmarshal(msg.Data, &m) == nil && r.OnText != nil {
			r.OnText(m.Text)
		}
	}
}

func (r *Receiver) handleRequest(raw []byte) {
	var m protocol.TransferRequest
	if err := json.Unmarshal(raw, &m); err != nil {
		return
	}
	r.remaining = len(m.Files)

	accept := true
	if r.OnRequest != nil {
		accept = r.OnRequest(m.BatchID, m.Files)
	}

	if accept {
		r.sendJSON(protocol.TransferAccept{Type: "accept", BatchID: m.BatchID})
	} else {
		r.sendJSON(protocol.TransferDecline{Type: "decline", BatchID: m.BatchID})
		r.finish(nil)
	}
}

func (r *Receiver) handleMeta(raw []byte) {
	var m protocol.TransferMeta
	if err := json.Unmarshal(raw, &m); err != nil {
		return
	}
	r.curMeta = m
	r.received = 0
	r.curHasher = sha256.New()

	if err := os.MkdirAll(r.outDir, 0o755); err != nil {
		r.finish(fmt.Errorf("transfer: create output dir: %w", err))
		return
	}
	// filepath.Base strips any directory components from the sender-supplied
	// name, preventing path traversal outside outDir.
	safeName := filepath.Base(m.FileName)
	path := filepath.Join(r.outDir, safeName)

	f, err := os.Create(path)
	if err != nil {
		r.finish(fmt.Errorf("transfer: create %s: %w", path, err))
		return
	}
	r.curFile = f
}

func (r *Receiver) handleChunk(data []byte) {
	if r.curFile == nil || r.curHasher == nil {
		return
	}
	r.curHasher.Write(data)
	n, err := r.curFile.Write(data)
	if err != nil {
		r.finish(fmt.Errorf("transfer: write chunk: %w", err))
		return
	}
	r.received += int64(n)
	if r.OnProgress != nil {
		r.OnProgress(RecvProgress{
			FileName:      r.curMeta.FileName,
			BytesReceived: r.received,
			TotalBytes:    r.curMeta.FileSize,
		})
	}
}

func (r *Receiver) handleComplete(raw []byte) {
	var m protocol.TransferComplete
	if err := json.Unmarshal(raw, &m); err != nil {
		return
	}
	if r.curFile == nil || r.curHasher == nil {
		return
	}

	digest := hex.EncodeToString(r.curHasher.Sum(nil))
	ok := digest == m.Checksum
	path := r.curFile.Name()
	r.curFile.Close()

	if !ok {
		os.Remove(path)
	} else if r.OnFileReceived != nil {
		r.OnFileReceived(r.curMeta.FileName, path)
	}
	r.sendJSON(protocol.TransferAck{Type: "ack", ID: m.ID, OK: ok})

	r.curFile = nil
	r.curHasher = nil
	r.remaining--

	if !ok {
		r.finish(fmt.Errorf("transfer: checksum mismatch for %s", r.curMeta.FileName))
		return
	}
	if r.curMeta.IsLastInQueue || r.remaining <= 0 {
		r.finish(nil)
	}
}

func (r *Receiver) handleCancel(raw []byte) {
	if r.curFile != nil {
		path := r.curFile.Name()
		r.curFile.Close()
		os.Remove(path)
		r.curFile = nil
		r.curHasher = nil
	}
	r.finish(fmt.Errorf("transfer: cancelled by sender"))
}

func (r *Receiver) finish(err error) {
	select {
	case r.done <- err:
	default:
	}
}

func (r *Receiver) sendJSON(v any) {
	raw, err := json.Marshal(v)
	if err != nil {
		return
	}
	_ = r.dc.SendText(string(raw))
}
