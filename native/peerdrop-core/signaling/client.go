// Package signaling implements the WebSocket client that talks to the
// PeerDrop signaling server (server/main.py), mirroring the browser
// client's openSocket/reconnect logic in client/src/context/PeerContext.tsx.
package signaling

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Client struct {
	url string

	mu       sync.Mutex
	conn     *websocket.Conn
	handlers map[string]func(raw []byte)

	closeOnce sync.Once
	closed    chan struct{}
}

func New(wsURL string) *Client {
	return &Client{
		url:      wsURL,
		handlers: make(map[string]func(raw []byte)),
		closed:   make(chan struct{}),
	}
}

func (c *Client) On(msgType string, handler func(raw []byte)) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.handlers[msgType] = handler
}

func (c *Client) Connect(ctx context.Context) error {
	if _, err := url.Parse(c.url); err != nil {
		return fmt.Errorf("signaling: invalid url: %w", err)
	}

	dialCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	conn, _, err := websocket.DefaultDialer.DialContext(dialCtx, c.url, nil)
	if err != nil {
		return fmt.Errorf("signaling: dial: %w", err)
	}

	c.mu.Lock()
	c.conn = conn
	c.mu.Unlock()

	go c.readLoop()
	return nil
}

func (c *Client) readLoop() {
	for {
		c.mu.Lock()
		conn := c.conn
		c.mu.Unlock()
		if conn == nil {
			return
		}

		_, raw, err := conn.ReadMessage()
		if err != nil {
			select {
			case <-c.closed:
			default:
				close(c.closed)
			}
			return
		}

		var env struct {
			Type string `json:"type"`
		}
		if err := json.Unmarshal(raw, &env); err != nil {
			continue
		}

		c.mu.Lock()
		handler := c.handlers[env.Type]
		c.mu.Unlock()
		if handler != nil {
			handler(raw)
		}
	}
}

func (c *Client) Send(v any) error {
	raw, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("signaling: marshal: %w", err)
	}

	c.mu.Lock()
	conn := c.conn
	c.mu.Unlock()
	if conn == nil {
		return fmt.Errorf("signaling: not connected")
	}
	return conn.WriteMessage(websocket.TextMessage, raw)
}

func (c *Client) Done() <-chan struct{} {
	return c.closed
}

func (c *Client) Close() error {
	c.mu.Lock()
	conn := c.conn
	c.mu.Unlock()
	if conn == nil {
		return nil
	}
	c.closeOnce.Do(func() {
		select {
		case <-c.closed:
		default:
			close(c.closed)
		}
	})
	return conn.Close()
}
