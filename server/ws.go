package main

import (
	"bufio"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/contrib/websocket"
)

type WSMessage struct {
	Type      string `json:"type"`
	Channel   string `json:"channel,omitempty"`
	Container string `json:"container,omitempty"`
	Tail      int    `json:"tail,omitempty"`
	Data      string `json:"data,omitempty"`
	Cols      int    `json:"cols,omitempty"`
	Rows      int    `json:"rows,omitempty"`
	Error     string `json:"error,omitempty"`
}

func handleWebSocket(c *websocket.Conn) {
	var (
		mu             sync.Mutex
		metricsUnsub   func()
		termConn       net.Conn
		termExecID     string
		logCancel      func()
	)

	send := func(msg interface{}) {
		mu.Lock()
		defer mu.Unlock()
		c.WriteJSON(msg)
	}

	for {
		_, raw, err := c.ReadMessage()
		if err != nil {
			break
		}

		var msg WSMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			continue
		}

		switch msg.Type {
		case "subscribe":
			if msg.Channel == "metrics" && metricsUnsub == nil {
				ch := make(chan *MetricsData, 8)
				metricsUnsub = startMetricsStream(ch)
				go func() {
					for data := range ch {
						send(map[string]interface{}{
							"type": "metrics",
							"data": data,
						})
					}
				}()
			}

		case "unsubscribe":
			if msg.Channel == "metrics" && metricsUnsub != nil {
				metricsUnsub()
				metricsUnsub = nil
			}

		case "terminal":
			if termConn != nil {
				termConn.Close()
				termConn = nil
			}
			cols := msg.Cols
			if cols == 0 {
				cols = 80
			}
			rows := msg.Rows
			if rows == 0 {
				rows = 24
			}

			// 1. Create exec
			execBody := fmt.Sprintf(`{"AttachStdin":true,"AttachStdout":true,"AttachStderr":true,"Tty":true,"Cmd":["/bin/sh"],"Env":["TERM=xterm"]}`)
			b, err := dockerPost("/containers/"+msg.Container+"/exec", strings.NewReader(execBody))
			if err != nil {
				send(WSMessage{Type: "terminal-error", Error: err.Error()})
				continue
			}
			var execResp struct {
				ID string `json:"Id"`
			}
			if err := json.Unmarshal(b, &execResp); err != nil {
				send(WSMessage{Type: "terminal-error", Error: err.Error()})
				continue
			}

			// 2. Connect via raw socket for hijacked exec start
			conn, err := net.Dial("unix", "/var/run/docker.sock")
			if err != nil {
				send(WSMessage{Type: "terminal-error", Error: err.Error()})
				continue
			}
			startBody := fmt.Sprintf(`{"Detach":false,"Tty":true}`)
			req := fmt.Sprintf("POST /exec/%s/start HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: %d\r\nConnection: Upgrade\r\nUpgrade: tcp\r\n\r\n%s",
				execResp.ID, len(startBody), startBody)
			conn.Write([]byte(req))

			// Read HTTP response headers
			br := bufio.NewReader(conn)
			for {
				line, err := br.ReadString('\n')
				if err != nil {
					conn.Close()
					break
				}
				if strings.TrimSpace(line) == "" {
					break
				}
			}

			termConn = conn
			termExecID = execResp.ID

			// Resize
			dockerPost(fmt.Sprintf("/exec/%s/resize?h=%d&w=%d", execResp.ID, rows, cols), nil)

			// Read from exec stream and forward to WS
			go func() {
				buf := make([]byte, 4096)
				for {
					n, err := br.Read(buf)
					if n > 0 {
						encoded := base64.StdEncoding.EncodeToString(buf[:n])
						send(map[string]interface{}{
							"type": "terminal-output",
							"data": encoded,
						})
					}
					if err != nil {
						break
					}
				}
				send(WSMessage{Type: "terminal-end"})
			}()

		case "terminal-input":
			if termConn != nil {
				termConn.Write([]byte(msg.Data))
			}

		case "terminal-resize":
			if termExecID != "" {
				cols := msg.Cols
				if cols == 0 {
					cols = 80
				}
				rows := msg.Rows
				if rows == 0 {
					rows = 24
				}
				dockerPost(fmt.Sprintf("/exec/%s/resize?h=%d&w=%d", termExecID, rows, cols), nil)
			}

		case "terminal-stop":
			if termConn != nil {
				termConn.Close()
				termConn = nil
			}
			termExecID = ""

		case "logs":
			if logCancel != nil {
				logCancel()
				logCancel = nil
			}

			containerID := msg.Container
			cancel := make(chan struct{})
			logCancel = func() { close(cancel) }

			// Subscribe to Docker events for this container
			go func() {
				filters := url.Values{}
				filters.Set("filters", fmt.Sprintf(`{"container":{"%s":true}}`, containerID))
				eventURL := fmt.Sprintf("http://localhost/events?%s", filters.Encode())
				for {
					select {
					case <-cancel:
						return
					default:
					}

					resp, err := httpDockerStream.Get(eventURL)
					if err != nil {
						time.Sleep(2 * time.Second)
						continue
					}

					scanner := bufio.NewScanner(resp.Body)
					for scanner.Scan() {
						line := scanner.Text()
						if line == "" {
							continue
						}
						var ev map[string]interface{}
						if json.Unmarshal([]byte(line), &ev) != nil {
							continue
						}
						select {
						case <-cancel:
							resp.Body.Close()
							return
						default:
						}
						send(map[string]interface{}{
							"type":  "log-event",
							"event": ev,
						})
					}
					resp.Body.Close()
				}
			}()

			// Stream container logs via Go HTTP client (handles chunked encoding)
			go func() {
				for {
					select {
					case <-cancel:
						return
					default:
					}

					url := fmt.Sprintf("http://localhost/containers/%s/logs?stdout=true&stderr=true&follow=true&tail=100000", containerID)
					resp, err := httpDockerStream.Get(url)
					if err != nil {
						send(WSMessage{Type: "log-error", Error: err.Error()})
						return
					}

					br := bufio.NewReader(resp.Body)
					buf := make([]byte, 4096)
					logReader := newDockerLogReader()
					for {
						select {
						case <-cancel:
							resp.Body.Close()
							return
						default:
						}

						n, err := br.Read(buf)
						if n > 0 {
							cleaned := logReader.Write(buf[:n])
							if len(cleaned) > 0 {
								send(map[string]interface{}{
									"type": "log-data",
									"data": string(cleaned),
								})
							}
						}
						if err != nil {
							resp.Body.Close()
							// Check if container still exists before reconnecting
							_, inspectErr := dockerGet("/containers/" + containerID + "/json")
							if inspectErr != nil {
								send(WSMessage{Type: "log-end"})
								return
							}
							// Container still exists — reconnect after brief delay
							time.Sleep(500 * time.Millisecond)
							break // go to outer for loop to reconnect
						}
					}
				}
			}()

		case "logs-stop":
			if logCancel != nil {
				logCancel()
				logCancel = nil
			}
		}
	}

	if metricsUnsub != nil {
		metricsUnsub()
	}
	if termConn != nil {
		termConn.Close()
	}
	if logCancel != nil {
		logCancel()
	}
}
