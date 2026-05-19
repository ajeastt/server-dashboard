package main

import (
	"encoding/json"
	"os"
	"sync"
)

var configPath = "/opt/server-dashboard/config.json"
var (
	cfgMutex sync.RWMutex
	appConfig Config
)

type Config struct {
	Widgets WidgetConfig `json:"widgets"`
}

type WidgetConfig struct {
	UniFi *UniFiConfig `json:"unifi,omitempty"`
}

type UniFiConfig struct {
	URL      string `json:"url"`
	Username string `json:"username"`
	Password string `json:"password"`
}

func loadConfig() error {
	cfgMutex.Lock()
	defer cfgMutex.Unlock()

	b, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			appConfig = Config{}
			return nil
		}
		return err
	}
	return json.Unmarshal(b, &appConfig)
}

func saveConfig(cfg Config) error {
	cfgMutex.Lock()
	defer cfgMutex.Unlock()

	b, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	appConfig = cfg
	return os.WriteFile(configPath, b, 0644)
}

func getConfig() Config {
	cfgMutex.RLock()
	defer cfgMutex.RUnlock()
	return appConfig
}

func init() {
	loadConfig()
}
