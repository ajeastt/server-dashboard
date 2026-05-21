package main

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
)

const smbConfPath = "/host/etc/samba/smb.conf"

type SmbStatus struct {
	Installed bool `json:"installed"`
	Running   bool `json:"running"`
	Enabled   bool `json:"enabled"`
}

type SmbShare struct {
	Name       string `json:"name"`
	Path       string `json:"path"`
	Comment    string `json:"comment,omitempty"`
	Browseable string `json:"browseable,omitempty"`
	ReadOnly   string `json:"readOnly,omitempty"`
	GuestOK    string `json:"guestOk,omitempty"`
	ValidUsers string `json:"validUsers,omitempty"`
	CreateMask string `json:"createMask,omitempty"`
	DirMask    string `json:"dirMask,omitempty"`
}

func chrootHost(args ...string) (string, error) {
	cmd := exec.Command("chroot", append([]string{"/host"}, args...)...)
	out, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

func handleSmbStatus(c *fiber.Ctx) error {
	if _, err := os.Stat("/host/usr/sbin/smbd"); os.IsNotExist(err) {
		return c.JSON(SmbStatus{Installed: false, Running: false, Enabled: false})
	}

	running := false
	out, err := chrootHost("systemctl", "is-active", "smb")
	if err != nil || strings.TrimSpace(out) != "active" {
		out, _ = chrootHost("pgrep", "-x", "smbd")
		if out != "" {
			running = true
		}
	} else {
		running = true
	}

	enabled := false
	out, _ = chrootHost("systemctl", "is-enabled", "smb")
	if strings.TrimSpace(out) == "enabled" {
		enabled = true
	}

	return c.JSON(SmbStatus{Installed: true, Running: running, Enabled: enabled})
}

func handleSmbInstall(c *fiber.Ctx) error {
	go func() {
		log.Printf("SMB: starting installation via chroot /host dnf install samba samba-client")
		out, err := chrootHost("dnf", "install", "-y", "samba", "samba-client")
		if err != nil {
			log.Printf("SMB: install failed: %v", err)
			log.Printf("SMB: output: %s", out)
		} else {
			log.Printf("SMB: install succeeded: %s", out)
		}
	}()

	return c.JSON(fiber.Map{"success": true, "message": "Installation started in background"})
}

func handleSmbService(c *fiber.Ctx) error {
	action := c.Params("action")
	allowed := map[string]bool{"start": true, "stop": true, "restart": true, "enable": true, "disable": true}
	if !allowed[action] {
		return c.Status(400).JSON(fiber.Map{"error": "invalid action"})
	}

	out, err := chrootHost("systemctl", action, "smb")
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error(), "output": out})
	}

	return c.JSON(fiber.Map{"success": true, "output": out})
}

func handleSmbShares(c *fiber.Ctx) error {
	if _, err := os.Stat(smbConfPath); os.IsNotExist(err) {
		return c.JSON([]SmbShare{})
	}

	f, err := os.Open(smbConfPath)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer f.Close()

	var shares []SmbShare
	var current *SmbShare

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, ";") {
			continue
		}

		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			name := line[1 : len(line)-1]
			if strings.ToLower(name) == "global" {
				current = nil
				continue
			}
			if current != nil {
				shares = append(shares, *current)
			}
			current = &SmbShare{Name: name}
			continue
		}

		if current == nil {
			continue
		}

		if idx := strings.Index(line, "="); idx >= 0 {
			key := strings.TrimSpace(line[:idx])
			val := strings.TrimSpace(line[idx+1:])
			switch strings.ToLower(key) {
			case "path":
				current.Path = val
			case "comment":
				current.Comment = val
			case "browseable":
				current.Browseable = val
			case "read only":
				current.ReadOnly = val
			case "guest ok":
				current.GuestOK = val
			case "valid users":
				current.ValidUsers = val
			case "create mask":
				current.CreateMask = val
			case "directory mask":
				current.DirMask = val
			}
		}
	}

	if current != nil {
		shares = append(shares, *current)
	}

	return c.JSON(shares)
}

func handleSmbAddShare(c *fiber.Ctx) error {
	var share SmbShare
	if err := c.BodyParser(&share); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if share.Name == "" || share.Path == "" {
		return c.Status(400).JSON(fiber.Map{"error": "name and path are required"})
	}

	dir := filepath.Dir(smbConfPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	f, err := os.OpenFile(smbConfPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer f.Close()

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("\n[%s]\n", share.Name))
	sb.WriteString(fmt.Sprintf("  path = %s\n", share.Path))
	if share.Comment != "" {
		sb.WriteString(fmt.Sprintf("  comment = %s\n", share.Comment))
	}
	sb.WriteString(fmt.Sprintf("  browseable = %s\n", ifEmpty(share.Browseable, "yes")))
	sb.WriteString(fmt.Sprintf("  read only = %s\n", ifEmpty(share.ReadOnly, "no")))
	sb.WriteString(fmt.Sprintf("  guest ok = %s\n", ifEmpty(share.GuestOK, "no")))
	if share.ValidUsers != "" {
		sb.WriteString(fmt.Sprintf("  valid users = %s\n", share.ValidUsers))
	}
	if share.CreateMask != "" {
		sb.WriteString(fmt.Sprintf("  create mask = %s\n", share.CreateMask))
	}
	if share.DirMask != "" {
		sb.WriteString(fmt.Sprintf("  directory mask = %s\n", share.DirMask))
	}

	if _, err := f.WriteString(sb.String()); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"success": true})
}

func handleSmbRemoveShare(c *fiber.Ctx) error {
	name := c.Params("name")
	if name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "name required"})
	}

	data, err := os.ReadFile(smbConfPath)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	lines := strings.Split(string(data), "\n")
	var out []string
	skip := false
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]") {
			sectionName := trimmed[1 : len(trimmed)-1]
			if sectionName == name {
				skip = true
				continue
			}
			skip = false
		}
		if skip {
			continue
		}
		out = append(out, line)
	}

	if err := os.WriteFile(smbConfPath, []byte(strings.Join(out, "\n")), 0644); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"success": true})
}

func ifEmpty(s, def string) string {
	if s == "" {
		return def
	}
	return s
}
