package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

var (
	authUsername = getEnv("AUTH_USERNAME", "admin")
	authPassword = getEnv("AUTH_PASSWORD", "admin")
	authSecret   = getEnv("AUTH_SECRET", "change-me-in-production")
)

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

type authToken struct {
	Username string `json:"u"`
	Expires  int64  `json:"e"`
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
	if body.Username != authUsername || body.Password != authPassword {
		return c.Status(401).JSON(fiber.Map{"error": "invalid credentials"})
	}
	token, err := createToken(body.Username)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "token creation failed"})
	}
	return c.JSON(fiber.Map{"token": token, "username": body.Username})
}

func authMiddleware(c *fiber.Ctx) error {
	path := c.Path()
	if path == "/api/auth/login" || path == "/api/monitoring/health" {
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
