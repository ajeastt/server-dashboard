package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func main() {
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{"error": err.Error()})
		},
	})

	app.Use(cors.New(cors.Config{AllowOrigins: "*"}))

	if err := initDocker(); err != nil {
		log.Fatalf("Docker client: %v", err)
	}

	initMetrics()

	// ── System ──
	sys := app.Group("/api/system")
	sys.Get("/info", handleSystemInfo)
	sys.Get("/disks", handleSystemDisks)

	// ── Monitoring ──
	mon := app.Group("/api/monitoring")
	mon.Get("/health", handleHealth)

	// ── Docker ──
	d := app.Group("/api/docker")
	d.Get("/containers", handleListContainers)
	d.Get("/containers/:id", handleGetContainer)
	d.Get("/containers/:id/stats", handleContainerStats)
	d.Get("/containers/:id/logs", handleContainerLogs)
	d.Post("/containers/:id/:action", handleContainerAction)
	d.Get("/images", handleListImages)
	d.Post("/images/pull", handlePullImage)
	d.Get("/images/pull-stream", handleImagePullStream)
	d.Post("/images/check-update", handleCheckImageUpdate)
	d.Delete("/images/:id", handleRemoveImage)
	d.Post("/images/prune", handlePruneImages)
	d.Get("/volumes", handleListVolumes)
	d.Post("/volumes", handleCreateVolume)
	d.Delete("/volumes/:name", handleRemoveVolume)
	d.Post("/volumes/prune", handlePruneVolumes)
	d.Get("/networks", handleListNetworks)
	d.Delete("/networks/:id", handleRemoveNetwork)
	d.Post("/networks/prune", handlePruneNetworks)
	d.Post("/prune", handleSystemPrune)
	d.Post("/stacks/validate", handleValidateCompose)
	d.Get("/stacks", handleListStacks)
	d.Post("/stacks", handleDeployStack)
	d.Post("/stacks/:name/restart", handleRestartStack)
	d.Post("/stacks/:name/update", handleUpdateStack)
	d.Get("/stacks/:name/update-stream", handleStackUpdateStream)
	d.Delete("/stacks/:name", handleDestroyStack)
	d.Get("/stacks/:name/compose", handleGetStackCompose)
	d.Put("/stacks/:name/compose", handleUpdateStackCompose)

	// ── Files ──
	f := app.Group("/api/files")
	f.Get("/list", handleFileList)
	f.Get("/read", handleFileRead)

	// ── Widget Config ──
	app.Get("/api/config", handleGetConfig)
	app.Put("/api/config", handleSaveConfig)
	app.Delete("/api/config/unifi", handleDeleteUniFiConfig)

	// ── Widget Data ──
	app.Get("/api/widgets/unifi/clients", handleUniFiClients)
	app.Get("/api/widgets/unifi/health", handleUniFiHealth)

	// ── WebSocket ──
	app.Get("/ws", websocket.New(handleWebSocket))

	// ── Static files + SPA fallback ──
	clientDist := "./client/dist"
	if _, err := os.Stat(clientDist); err == nil {
		app.Static("/", clientDist)
		app.Get("*", func(c *fiber.Ctx) error {
			p := c.Path()
			if strings.HasPrefix(p, "/api") || p == "/ws" {
				return fiber.ErrNotFound
			}
			return c.SendFile(filepath.Join(clientDist, "index.html"))
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}
	log.Printf("Server dashboard running on http://0.0.0.0:%s", port)
	log.Fatal(app.Listen("0.0.0.0:" + port))
}

// ── SSE helpers ──

type SSEWriter struct {
	w *bufio.Writer
}

func newSSE(c *fiber.Ctx) (*SSEWriter, error) {
	c.Context().SetContentType("text/event-stream")
	c.Response().Header.Set("Cache-Control", "no-cache")
	c.Response().Header.Set("Connection", "keep-alive")
	c.Response().Header.Set("X-Accel-Buffering", "no")
	w := bufio.NewWriter(c.Response().BodyWriter())
	return &SSEWriter{w: w}, nil
}

func (s *SSEWriter) Event(event string, data interface{}) error {
	b, _ := json.Marshal(data)
	if event != "" {
		if _, err := fmt.Fprintf(s.w, "event: %s\ndata: %s\n\n", event, b); err != nil {
			return err
		}
	} else {
		if _, err := fmt.Fprintf(s.w, "data: %s\n\n", b); err != nil {
			return err
		}
	}
	return s.w.Flush()
}

func (s *SSEWriter) Done() {
	s.Event("done", fiber.Map{})
}

func (s *SSEWriter) Error(msg string) {
	s.Event("error", fiber.Map{"error": msg})
}
