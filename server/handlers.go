package main

import (
	"bufio"
	"encoding/json"
	"io"
	"net"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

// ── System handlers ──

func handleSystemInfo(c *fiber.Ctx) error {
	info, err := getSystemInfo()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(info)
}

func handleSystemDisks(c *fiber.Ctx) error {
	disks, err := getDisks()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(disks)
}

func handleHealth(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"status": "ok", "timestamp": time.Now().UnixMilli()})
}

// ── Container handlers ──

func handleListContainers(c *fiber.Ctx) error {
	ctrs, err := listContainers()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(ctrs)
}

func handleGetContainer(c *fiber.Ctx) error {
	info, err := getContainerInspect(c.Params("id"))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(info)
}

func handleContainerStats(c *fiber.Ctx) error {
	stats, err := getContainerStats(c.Params("id"))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(stats)
}

func handleContainerLogs(c *fiber.Ctx) error {
	tail := c.Query("tail")
	if tail == "" {
		tail = "all"
	}
	logs, err := getContainerLogs(c.Params("id"), tail)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"logs": logs})
}

func handleContainerAction(c *fiber.Ctx) error {
	action := c.Params("action")
	allowed := map[string]bool{"start": true, "stop": true, "restart": true, "pause": true, "unpause": true, "kill": true}
	if !allowed[action] {
		return c.Status(400).JSON(fiber.Map{"error": "invalid action: " + action})
	}
	if err := containerAction(c.Params("id"), action); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true})
}

// ── Image handlers ──

func handleListImages(c *fiber.Ctx) error {
	imgs, err := listImages()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(imgs)
}

func handlePullImage(c *fiber.Ctx) error {
	var body struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if err := pullImage(body.Name); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true})
}

func handleCheckImageUpdate(c *fiber.Ctx) error {
	var body struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	result := checkImageUpdate(body.Name)
	return c.JSON(result)
}

func handleRemoveImage(c *fiber.Ctx) error {
	if err := removeImage(c.Params("id")); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true})
}

func handlePruneImages(c *fiber.Ctx) error {
	result, err := pruneImages()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

// ── Volume handlers ──

func handleListVolumes(c *fiber.Ctx) error {
	vols, err := listVolumes()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(vols)
}

func handleCreateVolume(c *fiber.Ctx) error {
	var body struct {
		Name   string `json:"name"`
		Driver string `json:"driver"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if body.Driver == "" {
		body.Driver = "local"
	}
	result, err := createVolume(body.Name, body.Driver)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

func handleRemoveVolume(c *fiber.Ctx) error {
	if err := removeVolume(c.Params("name")); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true})
}

func handlePruneVolumes(c *fiber.Ctx) error {
	result, err := pruneVolumes()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

// ── Network handlers ──

func handleListNetworks(c *fiber.Ctx) error {
	nets, err := listNetworks()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(nets)
}

func handleRemoveNetwork(c *fiber.Ctx) error {
	if err := removeNetwork(c.Params("id")); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true})
}

func handlePruneNetworks(c *fiber.Ctx) error {
	result, err := pruneNetworks()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

// ── System prune ──

func handleSystemPrune(c *fiber.Ctx) error {
	result, err := systemPrune()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

// ── Stack handlers ──

func handleValidateCompose(c *fiber.Ctx) error {
	var body struct {
		Content string `json:"content"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	tmpDir, err := os.MkdirTemp("", "compose-validate-*")
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"valid": false, "error": err.Error()})
	}
	defer os.RemoveAll(tmpDir)

	tmpPath := tmpDir + "/docker-compose.yml"
	if err := os.WriteFile(tmpPath, []byte(body.Content), 0644); err != nil {
		return c.Status(500).JSON(fiber.Map{"valid": false, "error": err.Error()})
	}

	cmd := exec.Command("docker", "compose", "-f", tmpPath, "config")
	if output, err := cmd.CombinedOutput(); err != nil {
		msg := string(output)
		if msg == "" {
			msg = err.Error()
		}
		return c.JSON(fiber.Map{"valid": false, "error": msg})
	}
	return c.JSON(fiber.Map{"valid": true})
}

func handleListStacks(c *fiber.Ctx) error {
	stacks, err := listStacks()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(stacks)
}

func handleDeployStack(c *fiber.Ctx) error {
	var body struct {
		Name    string `json:"name"`
		Compose string `json:"compose"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	if err := deployStack(body.Name, body.Compose); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true, "name": body.Name})
}

func handleRestartStack(c *fiber.Ctx) error {
	name := c.Params("name")
	if err := restartStack(name); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true, "name": name})
}

func handleUpdateStack(c *fiber.Ctx) error {
	name := c.Params("name")
	if err := updateStackImages(name); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true, "name": name})
}

func handleDestroyStack(c *fiber.Ctx) error {
	name := c.Params("name")
	if err := destroyStack(name); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true, "name": name})
}

func handleGetStackCompose(c *fiber.Ctx) error {
	name := c.Params("name")
	content, err := readStackCompose(name)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"content": content})
}

func handleUpdateStackCompose(c *fiber.Ctx) error {
	var body struct {
		Content string `json:"content"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	name := c.Params("name")
	if err := writeStackCompose(name, body.Content); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"success": true, "name": name})
}

// ── File handlers ──

func handleFileList(c *fiber.Ctx) error {
	path := c.Query("path", "/")
	result, err := listDirectory(path)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

func handleFileRead(c *fiber.Ctx) error {
	path := c.Query("path")
	if path == "" {
		return c.Status(400).JSON(fiber.Map{"error": "path is required"})
	}
	result, err := readFileContent(path)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(result)
}

// ── Image pull stream (SSE) ──

func handleImagePullStream(c *fiber.Ctx) error {
	name := c.Query("name")
	if name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "name query param required"})
	}

	sse, err := newSSE(c)
	if err != nil {
		return err
	}

	// Connect to Docker socket and POST to /images/create
	conn, err := net.Dial("unix", "/var/run/docker.sock")
	if err != nil {
		sse.Error("Docker socket: " + err.Error())
		return nil
	}
	defer conn.Close()

	body := "POST /images/create?fromImage=" + name + " HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n\r\n"
	conn.Write([]byte(body))

	// Read response headers first
	br := bufio.NewReader(conn)
	for {
		line, err := br.ReadString('\n')
		if err != nil {
			break
		}
		if strings.TrimSpace(line) == "" {
			break
		}
	}

	// Read JSON stream
	dec := json.NewDecoder(br)
	for {
		var raw map[string]interface{}
		if err := dec.Decode(&raw); err != nil {
			break
		}
		if err := sse.Event("", raw); err != nil {
			break
		}
	}
	sse.Done()
	return nil
}

// ── Stack update stream (SSE) ──

func handleStackUpdateStream(c *fiber.Ctx) error {
	name := c.Params("name")
	sse, err := newSSE(c)
	if err != nil {
		return err
	}

	dir, err := getStackComposeDir(name)
	if err != nil {
		sse.Error(err.Error())
		return nil
	}

	streamCmd := func(args []string) (bool, error) {
		cmd := exec.Command("docker", append([]string{"compose", "-p", name}, args...)...)
		cmd.Dir = dir
		stdout, _ := cmd.StdoutPipe()
		stderr, _ := cmd.StderrPipe()
		if err := cmd.Start(); err != nil {
			return false, err
		}

		reader := io.MultiReader(stdout, stderr)
		scanner := bufio.NewScanner(reader)
		pulled := false
		for scanner.Scan() {
			line := scanner.Text()
			if strings.Contains(line, "Downloaded newer image") {
				pulled = true
			}
			if err := sse.Event("", fiber.Map{"stream": line + "\n"}); err != nil {
				cmd.Process.Kill()
				return pulled, err
			}
		}
		return pulled, cmd.Wait()
	}

	pulled, err := streamCmd([]string{"pull"})
	if err != nil {
		sse.Error(err.Error())
		return nil
	}
	if !pulled {
		sse.Event("no-update", fiber.Map{})
		sse.Done()
		return nil
	}
	sse.Event("phase", fiber.Map{"phase": "up"})
	_, err = streamCmd([]string{"up", "-d"})
	if err != nil {
		sse.Error(err.Error())
		return nil
	}
	sse.Done()
	return nil
}


