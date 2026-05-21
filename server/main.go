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

	// ── Auth ──
	initAuth()

	// ── Auth middleware — applied to all /api routes ──
	app.Use("/api", authMiddleware)

	// Routes excluded from auth (checked inside middleware)
	app.Post("/api/auth/login", handleLogin)
	app.Post("/api/auth/change-password", handleChangePassword)
	app.Get("/api/monitoring/health", handleHealth)

	// ── System ──
	sys := app.Group("/api/system")
	sys.Get("/info", handleSystemInfo)
	sys.Get("/disks", handleSystemDisks)
	sys.Get("/block-devices", handleBlockDevices)

	// ── Docker ──
	d := app.Group("/api/docker")
	d.Get("/containers", handleListContainers)
	d.Get("/containers/stats", handleAllContainerStats)
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
	d.Get("/events", handleDockerEvents)
	d.Post("/stacks/validate", handleValidateCompose)
	d.Get("/stacks", handleListStacks)
	d.Post("/stacks", handleDeployStack)
	d.Post("/stacks/:name/restart", handleRestartStack)
	d.Post("/stacks/:name/update", handleUpdateStack)
	d.Get("/stacks/:name/update-stream", handleStackUpdateStream)
	d.Delete("/stacks/:name", handleDestroyStack)
	d.Get("/stacks/:name/compose", handleGetStackCompose)
	d.Put("/stacks/:name/compose", handleUpdateStackCompose)

	// ── Storage ──
	st := app.Group("/api/storage")
	st.Get("/mounts", handleListMounts)
	st.Post("/format", handleFormatDisk)
	st.Post("/unmount", handleUnmountDevice)
	st.Post("/pool", handleCreatePool)
	st.Delete("/pool/:name", handleDestroyPool)

	// ── Files ──
	f := app.Group("/api/files")
	f.Get("/list", handleFileList)
	f.Get("/read", handleFileRead)
	f.Put("/write", handleFileWrite)

	// ── WebSocket ──
	app.Get("/api/ws", websocket.New(handleWebSocket))

	// ── Static files + SPA fallback ──
	clientDist := "./client/dist"
	if _, err := os.Stat(clientDist); err == nil {
		app.Static("/", clientDist)
		app.Get("*", func(c *fiber.Ctx) error {
			p := c.Path()
			if strings.HasPrefix(p, "/api") {
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

	certFile := os.Getenv("SSL_CERT")
	keyFile := os.Getenv("SSL_KEY")
	if certFile != "" && keyFile != "" {
		go func() {
			sslPort := os.Getenv("SSL_PORT")
			if sslPort == "" {
				sslPort = "3443"
			}
			log.Printf("HTTPS listening on 0.0.0.0:%s", sslPort)
			if err := app.ListenTLS("0.0.0.0:"+sslPort, certFile, keyFile); err != nil {
				log.Fatalf("HTTPS server: %v", err)
			}
		}()
	}

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
