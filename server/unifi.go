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

func (u *unifiClient) login() error {
	body := fmt.Sprintf(`{"username":"%s","password":"%s"}`, u.username, u.password)
	req, err := http.NewRequest("POST", u.baseURL+"/api/login", strings.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := u.client.Do(req)
	if err != nil {
		return fmt.Errorf("login: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("login: status %d", resp.StatusCode)
	}
	return nil
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

type uniFiResp struct {
	Meta struct {
		RC string `json:"rc"`
	} `json:"meta"`
	Data []json.RawMessage `json:"data"`
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
		Wan1Interface       string `json:"wan1_iface"`
	} `json:"data"`
}

func (u *unifiClient) get(path string) ([]byte, error) {
	req, err := http.NewRequest("GET", u.baseURL+path, nil)
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
		resp, err = u.client.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
	}
	return io.ReadAll(resp.Body)
}

func (u *unifiClient) getActiveClients() ([]UniFiClient, error) {
	b, err := u.get("/api/s/default/stat/sta")
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
	b, err := u.get("/api/s/default/stat/health")
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
