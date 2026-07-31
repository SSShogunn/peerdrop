// Package session provides shared helpers the send/receive CLI commands
// use to connect to the signaling server and resolve ICE servers, matching
// the config knobs the browser client reads from VITE_* env vars.
package session

import (
	"context"
	"strings"

	"github.com/pion/webrtc/v4"

	peerdropcore "github.com/SSShogunn/peerdrop/native/peerdrop-core"
	"github.com/SSShogunn/peerdrop/native/peerdrop-core/signaling"
)

var (
	SignalingURL   string
	StunServersCSV string
)

func Connect(ctx context.Context) (*signaling.Client, error) {
	c := signaling.New(SignalingURL)
	if err := c.Connect(ctx); err != nil {
		return nil, err
	}
	return c, nil
}

func ResolveICEServers() []webrtc.ICEServer {
	var stunList []string
	if StunServersCSV != "" {
		stunList = strings.Split(StunServersCSV, ",")
	}

	turnServers, _ := signaling.FetchTURNServers(httpOrigin(SignalingURL))
	return signaling.BuildICEServers(stunList, turnServers)
}

func NewSession(sig *signaling.Client) (*peerdropcore.Session, error) {
	return peerdropcore.NewSession(sig, ResolveICEServers())
}

func httpOrigin(wsURL string) string {
	origin := wsURL
	if strings.HasPrefix(origin, "ws") {
		// mirrors client/src/context/PeerContext.tsx:64 — turns "ws"/"wss"
		// into "http"/"https" by replacing only the "ws" prefix.
		origin = "http" + origin[2:]
	}
	origin = strings.TrimSuffix(origin, "/ws/")
	origin = strings.TrimSuffix(origin, "/ws")
	return origin
}
