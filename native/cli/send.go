package main

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/pion/webrtc/v4"
	"github.com/spf13/cobra"

	"github.com/SSShogunn/peerdrop/native/cli/internal/session"
	"github.com/SSShogunn/peerdrop/native/peerdrop-core/protocol"
	"github.com/SSShogunn/peerdrop/native/peerdrop-core/transfer"
)

func newSendCmd() *cobra.Command {
	var chunkKB int

	cmd := &cobra.Command{
		Use:   "send <file> [file...]",
		Short: "Create a room and send files to whoever joins it",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return runSend(cmd.Context(), args, chunkKB*1024)
		},
	}
	cmd.Flags().IntVar(&chunkKB, "chunk-size-kb", 16, "data channel chunk size in KB")
	return cmd
}

func runSend(ctx context.Context, paths []string, chunkSize int) error {
	sig, err := session.Connect(ctx)
	if err != nil {
		return fmt.Errorf("connecting to signaling server: %w", err)
	}
	defer sig.Close()

	errCh := make(chan error, 1)
	sig.On("error", func(raw []byte) {
		var m protocol.ErrorMsg
		if json.Unmarshal(raw, &m) == nil {
			errCh <- fmt.Errorf("signaling: %s", m.Message)
		}
	})

	codeCh := make(chan string, 1)
	sig.On("room_created", func(raw []byte) {
		var m protocol.RoomCreatedMsg
		if json.Unmarshal(raw, &m) == nil {
			codeCh <- m.Code
		}
	})

	if err := sig.Send(protocol.CreateRoomMsg{Type: "create_room"}); err != nil {
		return err
	}

	var code string
	select {
	case code = <-codeCh:
	case err := <-errCh:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
	fmt.Printf("Room code: %s\nShare it with the receiver. Waiting for them to join...\n", code)

	peer, err := session.NewSession(sig)
	if err != nil {
		return err
	}
	defer peer.Close()

	dcCh := make(chan *webrtc.DataChannel, 1)
	peer.OnDataChannelOpen = func(dc *webrtc.DataChannel) { dcCh <- dc }
	peer.OnPeerDisconnected = func() { errCh <- fmt.Errorf("peer disconnected") }
	peer.OnError = func(err error) { errCh <- err }

	peerJoined := make(chan struct{}, 1)
	sig.On("peer_joined", func(raw []byte) { peerJoined <- struct{}{} })

	select {
	case <-peerJoined:
	case err := <-errCh:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}

	fmt.Println("Peer joined. Establishing connection...")
	if err := peer.StartOffer(ctx); err != nil {
		return err
	}

	var dc *webrtc.DataChannel
	select {
	case dc = <-dcCh:
	case err := <-errCh:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}

	fmt.Println("Connected. Sending files...")
	sender := transfer.NewSender(dc, chunkSize)

	lastPct := -1
	sendErr := sender.SendFiles(ctx, paths, func(p transfer.SendProgress) {
		pct := 100
		if p.TotalBytes > 0 {
			pct = int(p.BytesSent * 100 / p.TotalBytes)
		}
		if pct != lastPct {
			fmt.Printf("\r%s: %d%%", p.FileName, pct)
			lastPct = pct
		}
	})
	fmt.Println()
	if sendErr != nil {
		return sendErr
	}

	fmt.Println("Transfer complete.")
	return nil
}
