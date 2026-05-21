package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

var (
	authUsername     string
	authPasswordHash string
	mustChangePw     bool
	authSecret       = getEnv("AUTH_SECRET", "change-me-in-production")
	authFile         = getEnv("AUTH_FILE", "/data/auth.json")
	authMu           sync.RWMutex
)

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

type authConfig struct {
	Username     string `json:"username"`
	PasswordHash string `json:"passwordHash"`
}

type authToken struct {
	Username string `json:"u"`
	Expires  int64  `json:"e"`
}

func initAuth() {
	authMu.Lock()
	defer authMu.Unlock()

	if data, err := os.ReadFile(authFile); err == nil {
		var cfg authConfig
		if json.Unmarshal(data, &cfg) == nil && cfg.Username != "" && cfg.PasswordHash != "" {
			authUsername = cfg.Username
			authPasswordHash = cfg.PasswordHash
			mustChangePw = false
			return
		}
	}

	// First run — use defaults
	authUsername = getEnv("AUTH_USERNAME", "admin")
	plain := getEnv("AUTH_PASSWORD", "admin")
	authPasswordHash = hashPassword(plain)
	mustChangePw = true
}

func persistAuth(username, passwordHash string) error {
	cfg := authConfig{Username: username, PasswordHash: passwordHash}
	data, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	dir := authFile
	if idx := strings.LastIndex(authFile, "/"); idx > 0 {
		dir = authFile[:idx]
	}
	os.MkdirAll(dir, 0755)
	return os.WriteFile(authFile, data, 0600)
}

func hashPassword(pw string) string {
	h := sha256.Sum256([]byte(pw))
	return hex.EncodeToString(h[:])
}

func createToken(username string) (string, error) {
	t := authToken{Username: username, Expires: time.Now().Add(24 * time.Hour).Unix()}
	b, _ := json.Marshal(t)
	mac := hmac.New(sha256.New, []byte(authSecret))
	mac.Write(b)
	sig := hex.EncodeToString(mac.Sum(nil))
	return hex.EncodeToString(b) + "." + sig, nil
}

func verifyToken(token string) (*authToken, error) {
	parts := strings.SplitN(token, ".", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid token")
	}
	b, err := hex.DecodeString(parts[0])
	if err != nil {
		return nil, err
	}
	mac := hmac.New(sha256.New, []byte(authSecret))
	mac.Write(b)
	expected := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(parts[1]), []byte(expected)) {
		return nil, fmt.Errorf("invalid signature")
	}
	var t authToken
	json.Unmarshal(b, &t)
	if t.Expires < time.Now().Unix() {
		return nil, fmt.Errorf("token expired")
	}
	return &t, nil
}

func handleLogin(c *fiber.Ctx) error {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	authMu.RLock()
	userMatch := body.Username == authUsername
	pwMatch := hashPassword(body.Password) == authPasswordHash
	mustChange := mustChangePw
	authMu.RUnlock()

	if !userMatch || !pwMatch {
		return c.Status(401).JSON(fiber.Map{"error": "invalid credentials"})
	}

	token, err := createToken(body.Username)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "token creation failed"})
	}
	return c.JSON(fiber.Map{
		"token":              token,
		"username":           body.Username,
		"mustChangePassword": mustChange,
	})
}

func handleChangePassword(c *fiber.Ctx) error {
	// Verify token
	tokenStr := c.Get("Authorization")
	tokenStr = strings.TrimPrefix(tokenStr, "Bearer ")
	if tokenStr == "" {
		tokenStr = c.Query("token")
	}
	if _, err := verifyToken(tokenStr); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}

	var body struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	authMu.Lock()
	defer authMu.Unlock()

	// Verify current password
	if hashPassword(body.CurrentPassword) != authPasswordHash {
		return c.Status(400).JSON(fiber.Map{"error": "current password is incorrect"})
	}

	newHash := hashPassword(body.NewPassword)
	if err := persistAuth(authUsername, newHash); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to save password"})
	}

	authPasswordHash = newHash
	mustChangePw = false

	return c.JSON(fiber.Map{"success": true})
}

func authMiddleware(c *fiber.Ctx) error {
	path := c.Path()
	if path == "/api/auth/login" || path == "/api/monitoring/health" || path == "/api/auth/change-password" {
		return c.Next()
	}
	token := c.Get("Authorization")
	if token == "" {
		token = c.Query("token")
	} else {
		token = strings.TrimPrefix(token, "Bearer ")
	}
	if token == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	if _, err := verifyToken(token); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	return c.Next()
}
