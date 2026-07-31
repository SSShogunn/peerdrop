// Command peerdrop is a CLI client for PeerDrop, speaking the same
// signaling + WebRTC file-transfer protocol as the browser client so it can
// send/receive files with a browser tab or another peerdrop CLI instance.
package main

import (
	"fmt"
	"os"

	"github.com/SSShogunn/peerdrop/native/cli/internal/session"
	"github.com/spf13/cobra"
)

func main() {
	root := &cobra.Command{
		Use:           "peerdrop",
		Short:         "Send and receive files peer-to-peer over WebRTC",
		SilenceUsage:  true,
		SilenceErrors: true,
	}

	root.PersistentFlags().StringVar(&session.SignalingURL, "signaling-server", defaultEnv("PEERDROP_SIGNALING_SERVER", "wss://peerdrop.sshogunn.org/ws"), "signaling server WebSocket URL")
	root.PersistentFlags().StringVar(&session.StunServersCSV, "stun-servers", defaultEnv("PEERDROP_STUN_SERVERS", "stun:stun.l.google.com:19302"), "comma-separated STUN server URLs")

	root.AddCommand(newSendCmd())
	root.AddCommand(newReceiveCmd())

	if err := root.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func defaultEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
