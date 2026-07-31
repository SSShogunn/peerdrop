package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/pion/webrtc/v4"
	"github.com/spf13/cobra"

	"github.com/SSShogunn/peerdrop/native/cli/internal/session"
	"github.com/SSShogunn/peerdrop/native/peerdrop-core/protocol"
	"github.com/SSShogunn/peerdrop/native/peerdrop-core/transfer"
)

func newReceiveCmd() *cobra.Command {
	var outDir string
	var yes bool

	cmd := &cobra.Command{
		Use:   "receive <room-code>",
		Short: "Join a room and receive files sent by its creator",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return runReceive(cmd.Context(), args[0], outDir, yes)
		},
	}
	cmd.Flags().StringVar(&outDir, "out", ".", "directory to save received files to")
	cmd.Flags().BoolVarP(&yes, "yes", "y", false, "accept incoming transfers without prompting")
	return cmd
}

func runReceive(ctx context.Context, code, outDir string, autoAccept bool) error {
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

	joined := make(chan struct{}, 1)
	sig.On("room_joined", func(raw []byte) { joined <- struct{}{} })

	if err := sig.Send(protocol.JoinRoomMsg{Type: "join_room", Code: strings.ToUpper(code)}); err != nil {
		return err
	}

	select {
	case <-joined:
	case err := <-errCh:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
	fmt.Println("Joined room. Waiting for the sender to connect...")

	peer, err := session.NewSession(sig)
	if err != nil {
		return err
	}
	defer peer.Close()

	dcCh := make(chan *webrtc.DataChannel, 1)
	peer.OnDataChannelOpen = func(dc *webrtc.DataChannel) { dcCh <- dc }
	peer.OnPeerDisconnected = func() { errCh <- fmt.Errorf("peer disconnected") }
	peer.OnError = func(err error) { errCh <- err }

	sig.On("offer", func(raw []byte) {
		if err := peer.HandleOffer(raw); err != nil {
			errCh <- err
		}
	})

	var dc *webrtc.DataChannel
	select {
	case dc = <-dcCh:
	case err := <-errCh:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}

	fmt.Println("Connected. Waiting for a transfer request...")
	receiver := transfer.NewReceiver(dc, outDir)

	receiver.OnRequest = func(batchID string, files []protocol.FileSummary) bool {
		fmt.Println("Incoming files:")
		for _, f := range files {
			fmt.Printf("  %s (%s)\n", f.FileName, humanSize(f.FileSize))
		}
		if autoAccept {
			return true
		}
		return promptYesNo("Accept transfer?")
	}
	receiver.OnFileReceived = func(fileName, savedPath string) {
		fmt.Printf("\nSaved %s -> %s\n", fileName, savedPath)
	}
	receiver.OnText = func(text string) {
		fmt.Printf("\nReceived text: %s\n", text)
	}

	lastPct := -1
	receiver.OnProgress = func(p transfer.RecvProgress) {
		pct := 100
		if p.TotalBytes > 0 {
			pct = int(p.BytesReceived * 100 / p.TotalBytes)
		}
		if pct != lastPct {
			fmt.Printf("\r%s: %d%%", p.FileName, pct)
			lastPct = pct
		}
	}

	if err := receiver.Wait(ctx); err != nil {
		fmt.Println()
		return err
	}

	fmt.Println("\nTransfer complete.")
	return nil
}

func promptYesNo(prompt string) bool {
	fmt.Printf("%s [y/N]: ", prompt)
	reader := bufio.NewReader(os.Stdin)
	line, _ := reader.ReadString('\n')
	line = strings.TrimSpace(strings.ToLower(line))
	return line == "y" || line == "yes"
}

func humanSize(n int64) string {
	const unit = 1024
	if n < unit {
		return fmt.Sprintf("%d B", n)
	}
	div, exp := int64(unit), 0
	for m := n / unit; m >= unit; m /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %ciB", float64(n)/float64(div), "KMGTPE"[exp])
}
