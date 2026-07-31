package signaling

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/pion/webrtc/v4"
)

// turnCredentialsResponse mirrors what GET /turn-credentials on the
// signaling server returns (server/main.py) — either an empty
// {"iceServers": []} when TURN isn't configured, or Cloudflare's
// {"iceServers": {...}} shape.
type turnCredentialsResponse struct {
	ICEServers json.RawMessage `json:"iceServers"`
}

// cfIceServer is Cloudflare's single-object iceServers shape.
type cfIceServer struct {
	URLs       []string `json:"urls"`
	Username   string   `json:"username"`
	Credential string   `json:"credential"`
}

func FetchTURNServers(httpOrigin string) ([]webrtc.ICEServer, error) {
	client := http.Client{Timeout: 8 * time.Second}
	resp, err := client.Get(strings.TrimRight(httpOrigin, "/") + "/turn-credentials")
	if err != nil {
		return nil, fmt.Errorf("turn-credentials: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("turn-credentials: unexpected status %d", resp.StatusCode)
	}

	var body turnCredentialsResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("turn-credentials: decode: %w", err)
	}
	if len(body.ICEServers) == 0 || string(body.ICEServers) == "null" {
		return nil, nil
	}

	// Cloudflare returns a single object; some setups may return an array.
	// Handle both.
	var servers []cfIceServer
	if err := json.Unmarshal(body.ICEServers, &servers); err == nil {
		return toWebRTCServers(servers), nil
	}

	var single cfIceServer
	if err := json.Unmarshal(body.ICEServers, &single); err == nil {
		return toWebRTCServers([]cfIceServer{single}), nil
	}

	return nil, fmt.Errorf("turn-credentials: unrecognized iceServers shape")
}

func toWebRTCServers(servers []cfIceServer) []webrtc.ICEServer {
	out := make([]webrtc.ICEServer, 0, len(servers))
	for _, s := range servers {
		if len(s.URLs) == 0 {
			continue
		}
		out = append(out, webrtc.ICEServer{
			URLs:       s.URLs,
			Username:   s.Username,
			Credential: s.Credential,
		})
	}
	return out
}

func BuildICEServers(stunURLs []string, turnServers []webrtc.ICEServer) []webrtc.ICEServer {
	out := make([]webrtc.ICEServer, 0, len(stunURLs)+len(turnServers))
	for _, u := range stunURLs {
		u = strings.TrimSpace(u)
		if u == "" {
			continue
		}
		out = append(out, webrtc.ICEServer{URLs: []string{u}})
	}
	out = append(out, turnServers...)
	return out
}
