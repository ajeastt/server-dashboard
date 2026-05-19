package main

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"strings"
	"time"
)

type unifiClient struct {
	baseURL    string
	username   string
	password   string
	client     *http.Client
	apiPrefix  string
}

func newUnifiClient(cfg *UniFiConfig) *unifiClient {
	jar, _ := cookiejar.New(nil)
	base := strings.TrimRight(cfg.URL, "/")
	return &unifiClient{
		baseURL:  base,
		username: cfg.Username,
		password: cfg.Password,
		client: &http.Client{
			Timeout: 10 * time.Second,
			Jar:     jar,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
			},
		},
	}
}

// tryLogin attempts to log in with the given API prefix path.
// Returns true on success.
func (u *unifiClient) tryLogin(prefix string) bool {
	body := fmt.Sprintf(`{"username":"%s","password":"%s"}`, u.username, u.password)
	req, err := http.NewRequest("POST", u.baseURL+prefix+"/login", strings.NewReader(body))
	if err != nil {
		return false
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := u.client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == 200
}

func (u *unifiClient) login() error {
	if u.apiPrefix != "" {
		// Already detected, just re-login
		body := fmt.Sprintf(`{"username":"%s","password":"%s"}`, u.username, u.password)
		req, _ := http.NewRequest("POST", u.baseURL+u.apiPrefix+"/login", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := u.client.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		if resp.StatusCode != 200 {
			return fmt.Errorf("login: status %d", resp.StatusCode)
		}
		return nil
	}

	// Auto-detect API path: try classic first, then UniFi OS proxy path
	if u.tryLogin("/api") {
		u.apiPrefix = "/api"
		return nil
	}
	if u.tryLogin("/proxy/network/api") {
		u.apiPrefix = "/proxy/network/api"
		return nil
	}
	return fmt.Errorf("login failed: could not reach UniFi controller")
}

func (u *unifiClient) get(path string) ([]byte, error) {
	if u.apiPrefix == "" {
		if err := u.login(); err != nil {
			return nil, err
		}
	}

	fullPath := u.apiPrefix + path
	req, err := http.NewRequest("GET", u.baseURL+fullPath, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	resp, err := u.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		if err := u.login(); err != nil {
			return nil, err
		}
		req, _ = http.NewRequest("GET", u.baseURL+fullPath, nil)
		req.Header.Set("Accept", "application/json")
		resp2, err := u.client.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp2.Body.Close()
		return io.ReadAll(resp2.Body)
	}

	return io.ReadAll(resp.Body)
}

type UniFiClient struct {
	MAC       string `json:"mac"`
	Hostname  string `json:"hostname"`
	IP        string `json:"ip"`
	Network   string `json:"network"`
	Signal    int    `json:"signal"`
	Uptime    int64  `json:"uptime"`
	BytesRx   int64  `json:"bytes_rx"`
	BytesTx   int64  `json:"bytes_tx"`
	Name      string `json:"name"`
	IsWired   bool   `json:"is_wired"`
}

type UniFiHealth struct {
	Status        string `json:"status"`
	NumClients    int    `json:"num_clients"`
	NumWifi       int    `json:"num_wifi"`
	NumWired      int    `json:"num_wired"`
	WANIP         string `json:"wan_ip"`
	WANGateway    string `json:"wan_gateway"`
	Internet      string `json:"internet"`
	LANSubnet     string `json:"lan_subnet"`
	Uptime        int64  `json:"uptime"`
}

type uniFiHealthResp struct {
	Meta struct {
		RC string `json:"rc"`
	} `json:"meta"`
	Data []struct {
		Status              string `json:"status"`
		NumSta              int    `json:"num_sta"`
		NumUser             int    `json:"num_user"`
		NumGuest            int    `json:"num_guest"`
		NumWifi             int    `json:"num_wifi"`
		WANIP               string `json:"wan_ip"`
		WANGateway          string `json:"wan_gateway"`
		Internet            string `json:"internet"`
		LANSubnet           string `json:"lan_subnet"`
		SysUpTime           int64  `json:"sys_uptime"`
	} `json:"data"`
}

func (u *unifiClient) getActiveClients() ([]UniFiClient, error) {
	b, err := u.get("/s/default/stat/sta")
	if err != nil {
		return nil, err
	}
	var raw struct {
		Meta struct {
			RC string `json:"rc"`
		} `json:"meta"`
		Data []struct {
			MAC       string `json:"mac"`
			Hostname  string `json:"hostname"`
			IP        string `json:"ip"`
			Network   string `json:"network"`
			Signal    int    `json:"signal"`
			Uptime    int64  `json:"uptime"`
			BytesRx   int64  `json:"bytes_rx"`
			BytesTx   int64  `json:"bytes_tx"`
			Name      string `json:"name"`
			IsWired   bool   `json:"is_wired"`
		} `json:"data"`
	}
	if err := json.Unmarshal(b, &raw); err != nil {
		return nil, err
	}
	clients := make([]UniFiClient, len(raw.Data))
	for i, d := range raw.Data {
		clients[i] = UniFiClient{
			MAC:       d.MAC,
			Hostname:  d.Hostname,
			IP:        d.IP,
			Network:   d.Network,
			Signal:    d.Signal,
			Uptime:    d.Uptime,
			BytesRx:   d.BytesRx,
			BytesTx:   d.BytesTx,
			Name:      d.Name,
			IsWired:   d.IsWired,
		}
	}
	return clients, nil
}

func (u *unifiClient) getHealth() (*UniFiHealth, error) {
	b, err := u.get("/s/default/stat/health")
	if err != nil {
		return nil, err
	}
	var raw uniFiHealthResp
	if err := json.Unmarshal(b, &raw); err != nil {
		return nil, err
	}
	if len(raw.Data) == 0 {
		return nil, fmt.Errorf("no health data")
	}
	d := raw.Data[0]
	totalWired := d.NumSta - d.NumWifi
	return &UniFiHealth{
		Status:        d.Status,
		NumClients:    d.NumSta,
		NumWifi:       d.NumWifi,
		NumWired:      totalWired,
		WANIP:         d.WANIP,
		WANGateway:    d.WANGateway,
		Internet:      d.Internet,
		LANSubnet:     d.LANSubnet,
		Uptime:        d.SysUpTime,
	}, nil
}
