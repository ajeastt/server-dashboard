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
	baseURL  string
	username string
	password string
	client   *http.Client
	api      string // API prefix for data endpoints, e.g. "/api" or "/proxy/network/api"
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

// loginAttemp describes one authentication strategy to try.
type loginAttemp struct {
	login    string // full login path (without baseURL)
	api      string // API prefix for subsequent data calls
	label    string // for error messages
}

func (u *unifiClient) login() error {
	if u.api != "" {
		// Already detected — just re-login with the stored credentials.
		return u.reLogin()
	}

	// First check if the host is reachable at all.
	testReq, err := http.NewRequest("GET", u.baseURL+"/", nil)
	if err == nil {
		testResp, testErr := u.client.Do(testReq)
		if testErr != nil {
			return fmt.Errorf("cannot reach %s: %v", u.baseURL, testErr)
		}
		testResp.Body.Close()
	}

	// Try strategies in order.
	// Standalone controller:  login /api/login        → data /api/...
	// UniFi OS (UDM Pro):     login /api/auth/login   → data /proxy/network/api/...
	attempts := []loginAttemp{
		{"/api/login", "/api", "classic"},
		{"/api/auth/login", "/proxy/network/api", "UniFi OS"},
	}

	for _, a := range attempts {
		code, err := u.tryLogin(a.login)
		if err != nil {
			continue
		}
		if code == 200 {
			u.api = a.api
			return nil
		}
		if code == 401 {
			return fmt.Errorf("wrong username or password (tried %s at %s%s)", a.label, u.baseURL, a.login)
		}
	}
	return fmt.Errorf("could not find UniFi API at %s (tried /api/login and /api/auth/login)", u.baseURL)
}

func (u *unifiClient) tryLogin(path string) (int, error) {
	body := fmt.Sprintf(`{"username":"%s","password":"%s"}`, u.username, u.password)
	req, err := http.NewRequest("POST", u.baseURL+path, strings.NewReader(body))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := u.client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	return resp.StatusCode, nil
}

func (u *unifiClient) reLogin() error {
	// Determine the login path from the API prefix.
	// Standalone:  api="/api"   → login="/api/login"
	// UniFi OS:    api="/proxy/network/api" → login="/api/auth/login"
	loginPath := u.api + "/login"
	if strings.Contains(u.api, "proxy") {
		loginPath = "/api/auth/login"
	}

	body := fmt.Sprintf(`{"username":"%s","password":"%s"}`, u.username, u.password)
	req, _ := http.NewRequest("POST", u.baseURL+loginPath, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := u.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("re-login failed (HTTP %d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}

func (u *unifiClient) get(path string) ([]byte, error) {
	if u.api == "" {
		if err := u.login(); err != nil {
			return nil, err
		}
	}

	fullPath := u.api + path
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
		if err := u.reLogin(); err != nil {
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
		Status        string `json:"status"`
		NumSta        int    `json:"num_sta"`
		NumUser       int    `json:"num_user"`
		NumGuest      int    `json:"num_guest"`
		NumWifi       int    `json:"num_wifi"`
		WANIP         string `json:"wan_ip"`
		WANGateway    string `json:"wan_gateway"`
		Internet      string `json:"internet"`
		LANSubnet     string `json:"lan_subnet"`
		SysUpTime     int64  `json:"sys_uptime"`
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
