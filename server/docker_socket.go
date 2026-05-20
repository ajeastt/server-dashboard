package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// Docker socket HTTP client — no SDK dependency needed.

var httpDocker = &http.Client{
	Transport: &http.Transport{
		Dial: func(proto, addr string) (net.Conn, error) {
			return net.Dial("unix", "/var/run/docker.sock")
		},
		MaxIdleConns: 10,
	},
	Timeout: 120 * time.Second,
}

var httpClient = &http.Client{Timeout: 15 * time.Second}

// httpDockerStream has no timeout for long-lived streaming connections (logs follow, events).
var httpDockerStream = &http.Client{
	Transport: &http.Transport{
		Dial: func(proto, addr string) (net.Conn, error) {
			return net.Dial("unix", "/var/run/docker.sock")
		},
	},
}

var dockerVersion string

func dockerGet(path string) ([]byte, error) {
	resp, err := httpDocker.Get("http://localhost" + path)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("docker API %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}
	return io.ReadAll(resp.Body)
}

func dockerPost(path string, body io.Reader) ([]byte, error) {
	req, err := http.NewRequest("POST", "http://localhost"+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpDocker.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("docker API %s: %s", resp.Status, strings.TrimSpace(string(b)))
	}
	return io.ReadAll(resp.Body)
}

func dockerDelete(path string) ([]byte, error) {
	req, err := http.NewRequest("DELETE", "http://localhost"+path, nil)
	if err != nil {
		return nil, err
	}
	resp, err := httpDocker.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("docker API %s: %s", resp.Status, strings.TrimSpace(string(b)))
	}
	return io.ReadAll(resp.Body)
}

// ── Response types (mirroring Node.js JSON output) ──

type ContainerResp struct {
	ID             string            `json:"id"`
	Name           string            `json:"name"`
	Image          string            `json:"image"`
	ImageID        string            `json:"imageId"`
	State          string            `json:"state"`
	Status         string            `json:"status"`
	Ports          []PortResp        `json:"ports"`
	Created        int64             `json:"created"`
	ComposeProject string            `json:"composeProject"`
	Labels         map[string]string `json:"-"`
}

type PortResp struct {
	IP          string `json:"IP"`
	PrivatePort uint16 `json:"PrivatePort"`
	PublicPort  uint16 `json:"PublicPort"`
	Type        string `json:"Type"`
}

type StatsResp struct {
	CPUPercent float64 `json:"cpuPercent"`
	MemUsage   uint64  `json:"memUsage"`
	MemLimit   uint64  `json:"memLimit"`
	MemPercent float64 `json:"memPercent"`
	NetworkRx  uint64  `json:"networkRx"`
	NetworkTx  uint64  `json:"networkTx"`
}

type ImageResp struct {
	ID       string   `json:"id"`
	Tags     []string `json:"tags"`
	Digests  []string `json:"digests"`
	Dangling bool     `json:"dangling"`
	Size     int64    `json:"size"`
	Created  int64    `json:"created"`
	UsedBy   []string `json:"usedBy"`
}

type VolumeResp struct {
	Name       string `json:"name"`
	Driver     string `json:"driver"`
	Mountpoint string `json:"mountpoint"`
	Size       int64  `json:"size"`
	Created    string `json:"created"`
}

type NetworkResp struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Driver     string `json:"driver"`
	Scope      string `json:"scope"`
	Containers int    `json:"containers"`
	Created    string `json:"created"`
}

type StackResp struct {
	Name     string         `json:"name"`
	Services []StackService `json:"services"`
	Status   string         `json:"status"`
}

type StackService struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	State string `json:"state"`
}

type CheckUpdateResp struct {
	Name            string `json:"name"`
	Tag             string `json:"tag,omitempty"`
	RemoteDigest    string `json:"remoteDigest,omitempty"`
	LocalDigest     string `json:"localDigest,omitempty"`
	UpdateAvailable bool   `json:"updateAvailable"`
	Error           string `json:"error,omitempty"`
}

type DiskResp struct {
	FS      string  `json:"fs"`
	Mount   string  `json:"mount"`
	FSType  string  `json:"fstype"`
	Size    uint64  `json:"size"`
	Used    uint64  `json:"used"`
	Free    uint64  `json:"free"`
	Percent float64 `json:"percent"`
}

type FileEntry struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	Size     int64  `json:"size"`
	Mode     string `json:"mode"`
	Mtime    int64  `json:"mtime"`
	Type     string `json:"type"`
	IsSymlink bool  `json:"isSymlink"`
}

type FileListResp struct {
	Path   string      `json:"path"`
	Parent string      `json:"parent"`
	Items  []FileEntry `json:"items"`
}

type FileReadResp struct {
	Content  string `json:"content"`
	Binary   bool   `json:"binary"`
	Encoding string `json:"encoding"`
}

func initDocker() error {
	// Verify the socket is accessible
	_, err := os.Stat("/var/run/docker.sock")
	if err != nil {
		return fmt.Errorf("Docker socket not found: %v", err)
	}
	// Ping the Docker API
	b, err := dockerGet("/_ping")
	if err != nil {
		return fmt.Errorf("Docker ping failed: %v", err)
	}
	dockerVersion = string(b)
	return nil
}

// ── Container operations ──

type dockerContainer struct {
	ID      string            `json:"Id"`
	Names   []string          `json:"Names"`
	Image   string            `json:"Image"`
	ImageID string            `json:"ImageID"`
	State   string            `json:"State"`
	Status  string            `json:"Status"`
	Ports   []PortResp        `json:"Ports"`
	Created int64             `json:"Created"`
	Labels  map[string]string `json:"Labels"`
}

func listContainers() ([]ContainerResp, error) {
	b, err := dockerGet("/containers/json?all=true")
	if err != nil {
		return nil, err
	}
	var raw []dockerContainer
	if err := json.Unmarshal(b, &raw); err != nil {
		return nil, err
	}
	res := make([]ContainerResp, 0, len(raw))
	for _, c := range raw {
		name := "unknown"
		if len(c.Names) > 0 {
			name = strings.TrimPrefix(c.Names[0], "/")
		}
		res = append(res, ContainerResp{
			ID:             c.ID[:12],
			Name:           name,
			Image:          c.Image,
			ImageID:        c.ImageID,
			State:          c.State,
			Status:         c.Status,
			Ports:          c.Ports,
			Created:        c.Created,
			ComposeProject: c.Labels["com.docker.compose.project"],
			Labels:         c.Labels,
		})
	}
	return res, nil
}

func getContainerInspect(id string) (interface{}, error) {
	b, err := dockerGet("/containers/" + id + "/json")
	if err != nil {
		return nil, err
	}
	var raw interface{}
	json.Unmarshal(b, &raw)
	return raw, nil
}

type dockerStats struct {
	CPUStats    cpuStats    `json:"cpu_stats"`
	PreCPUStats cpuStats    `json:"precpu_stats"`
	MemoryStats memoryStats `json:"memory_stats"`
	Networks    map[string]networkStats `json:"networks"`
}

type cpuStats struct {
	CPUUsage struct {
		TotalUsage uint64 `json:"total_usage"`
	} `json:"cpu_usage"`
	SystemUsage  uint64 `json:"system_cpu_usage"`
	OnlineCPUs   uint32 `json:"online_cpus"`
}

type memoryStats struct {
	Usage uint64 `json:"usage"`
	Limit uint64 `json:"limit"`
}

type networkStats struct {
	RxBytes uint64 `json:"rx_bytes"`
	TxBytes uint64 `json:"tx_bytes"`
}

func getContainerStats(id string) (*StatsResp, error) {
	b, err := dockerGet("/containers/" + id + "/stats?stream=false")
	if err != nil {
		return nil, err
	}
	var raw dockerStats
	if err := json.Unmarshal(b, &raw); err != nil {
		return nil, err
	}

	cpuDelta := raw.CPUStats.CPUUsage.TotalUsage - raw.PreCPUStats.CPUUsage.TotalUsage
	sysDelta := raw.CPUStats.SystemUsage - raw.PreCPUStats.SystemUsage
	cpuPct := 0.0
	if sysDelta > 0 && raw.CPUStats.OnlineCPUs > 0 {
		cpuPct = (float64(cpuDelta) / float64(sysDelta)) * float64(raw.CPUStats.OnlineCPUs) * 100
	}

	memLimit := raw.MemoryStats.Limit
	memUsage := raw.MemoryStats.Usage
	memPct := 0.0
	if memLimit > 0 {
		memPct = (float64(memUsage) / float64(memLimit)) * 100
	}

	var rx, tx uint64
	for _, iface := range raw.Networks {
		rx += iface.RxBytes
		tx += iface.TxBytes
	}

	return &StatsResp{
		CPUPercent: round2(cpuPct),
		MemUsage:   memUsage,
		MemLimit:   memLimit,
		MemPercent: round2(memPct),
		NetworkRx:  rx,
		NetworkTx:  tx,
	}, nil
}

func getContainerLogs(id string, tail string) (string, error) {
	resp, err := httpDocker.Get(fmt.Sprintf("http://localhost/containers/%s/logs?stdout=true&stderr=true&tail=%s", id, tail))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return stripDockerHeaders(data), nil
}

func stripDockerHeaders(data []byte) string {
	var out strings.Builder
	offset := 0
	for offset+8 <= len(data) {
		payloadLen := (int(data[offset+4]) << 24) | (int(data[offset+5]) << 16) | (int(data[offset+6]) << 8) | int(data[offset+7])
		if offset+8+payloadLen > len(data) {
			break
		}
		out.Write(data[offset+8 : offset+8+payloadLen])
		offset += 8 + payloadLen
	}
	return out.String()
}

// dockerLogReader buffers raw log data and extracts complete Docker log frames.
// Docker log framing: 8-byte header (stream type[1] + padding[3] + big-endian length[4]) + payload.
// TCP reads may split frames arbitrarily; this reader handles that correctly.
// Output includes stream marker bytes: \x01 for stdout, \x02 for stderr, before each frame's text.
type dockerLogReader struct {
	buf []byte
}

func newDockerLogReader() *dockerLogReader {
	return &dockerLogReader{}
}

// Write feeds raw bytes into the reader. It returns any complete frames' payload as text,
// with each frame prefixed by its stream type byte (1=stdout, 2=stderr).
func (r *dockerLogReader) Write(data []byte) string {
	r.buf = append(r.buf, data...)
	var out strings.Builder
	for {
		if len(r.buf) < 8 {
			break
		}
		streamType := r.buf[0]
		payloadLen := (int(r.buf[4]) << 24) | (int(r.buf[5]) << 16) | (int(r.buf[6]) << 8) | int(r.buf[7])
		frameEnd := 8 + payloadLen
		if len(r.buf) < frameEnd {
			break
		}
		out.WriteByte(streamType)
		out.Write(r.buf[8:frameEnd])
		r.buf = r.buf[frameEnd:]
	}
	return out.String()
}

// getDockerEvents fetches recent Docker events (last hour).
func getDockerEvents() ([]map[string]interface{}, error) {
	now := time.Now()
	since := now.Unix() - 3600
	until := now.Unix()
	path := fmt.Sprintf("/events?since=%d&until=%d", since, until)
	body, err := dockerGet(path)
	if err != nil {
		return nil, err
	}
	var events []map[string]interface{}
	for _, line := range strings.Split(strings.TrimSpace(string(body)), "\n") {
		if line == "" {
			continue
		}
		var event map[string]interface{}
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			continue
		}
		events = append(events, event)
	}
	// Keep only the most recent 100 events
	if len(events) > 100 {
		events = events[len(events)-100:]
	}
	return events, nil
}

func containerAction(id, action string) error {
	_, err := dockerPost("/containers/"+id+"/"+action, nil)
	return err
}

// ── Image operations ──

type dockerImage struct {
	ID          string   `json:"Id"`
	RepoTags    []string `json:"RepoTags"`
	RepoDigests []string `json:"RepoDigests"`
	Size        int64    `json:"Size"`
	Created     int64    `json:"Created"`
}

func listImages() ([]ImageResp, error) {
	b, err := dockerGet("/images/json?all=false")
	if err != nil {
		return nil, err
	}
	var raw []dockerImage
	if err := json.Unmarshal(b, &raw); err != nil {
		return nil, err
	}

	// Build used-by map
	ctrs, _ := listContainers()
	usedBy := make(map[string][]string)
	for _, c := range ctrs {
		usedBy[c.ImageID] = append(usedBy[c.ImageID], c.Name)
	}

	res := make([]ImageResp, 0, len(raw))
	for _, img := range raw {
		shortID := img.ID
		if len(shortID) > 19 {
			shortID = shortID[7:19]
		}
		tags := img.RepoTags
		if tags == nil {
			tags = []string{}
		}
		digests := img.RepoDigests
		if digests == nil {
			digests = []string{}
		}
		dangling := len(img.RepoTags) == 0 || allNoneTags(img.RepoTags)
		ub := usedBy[img.ID]
		if ub == nil {
			ub = []string{}
		}
		res = append(res, ImageResp{
			ID:       shortID,
			Tags:     tags,
			Digests:  digests,
			Dangling: dangling,
			Size:     img.Size,
			Created:  img.Created,
			UsedBy:   ub,
		})
	}
	return res, nil
}

func allNoneTags(tags []string) bool {
	for _, t := range tags {
		if t != "<none>:<none>" {
			return false
		}
	}
	return true
}

func pullImage(name string) error {
	_, err := dockerPost("/images/create?fromImage="+name, nil)
	return err
}

func checkImageUpdate(name string) *CheckUpdateResp {
	tag := "latest"
	repo := name
	if idx := strings.LastIndex(name, ":"); idx >= 0 {
		repo = name[:idx]
		tag = name[idx+1:]
	}

	regRepo := repo
	if !strings.Contains(repo, "/") {
		regRepo = "library/" + repo
	}

	tokenURL := fmt.Sprintf("https://auth.docker.io/token?service=registry.docker.io&scope=repository:%s:pull", regRepo)
	tresp, err := httpClient.Get(tokenURL)
	if err != nil {
		return &CheckUpdateResp{Name: name, Error: "registry_unreachable"}
	}
	defer tresp.Body.Close()

	var auth struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(tresp.Body).Decode(&auth); err != nil || auth.Token == "" {
		return &CheckUpdateResp{Name: name, Error: "auth_failed"}
	}

	manifestURL := fmt.Sprintf("https://registry-1.docker.io/v2/%s/manifests/%s", regRepo, tag)
	mreq, _ := http.NewRequest("GET", manifestURL, nil)
	mreq.Header.Set("Authorization", "Bearer "+auth.Token)
	mreq.Header.Set("Accept", "application/vnd.docker.distribution.manifest.v2+json")
	mresp, err := httpClient.Do(mreq)
	if err != nil {
		return &CheckUpdateResp{Name: name, Error: "manifest_fetch_failed"}
	}
	defer mresp.Body.Close()
	remoteDigest := mresp.Header.Get("docker-content-digest")

	// Compare with local
	b, err := dockerGet("/images/json?all=false")
	if err == nil {
		var imgs []dockerImage
		json.Unmarshal(b, &imgs)
		localTag := repo + ":" + tag
		var localDigest string
		for _, img := range imgs {
			for _, t := range img.RepoTags {
				if t == localTag {
					for _, d := range img.RepoDigests {
						if strings.Contains(d, repo) {
							parts := strings.SplitN(d, "@", 2)
							if len(parts) == 2 {
								localDigest = parts[1]
							}
						}
					}
				}
			}
		}
		updateAvail := localDigest == "" || localDigest != remoteDigest
		return &CheckUpdateResp{
			Name: name, Tag: tag, RemoteDigest: remoteDigest,
			LocalDigest: localDigest, UpdateAvailable: updateAvail,
		}
	}

	return &CheckUpdateResp{Name: name, Error: "registry_unreachable"}
}

func removeImage(id string) error {
	_, err := dockerDelete("/images/" + id + "?force=true")
	return err
}

func pruneImages() (interface{}, error) {
	b, err := dockerPost("/images/prune?filters=%7B%7D", nil)
	if err != nil {
		return nil, err
	}
	var r struct {
		ImagesDeleted  []interface{} `json:"ImagesDeleted"`
		SpaceReclaimed uint64        `json:"SpaceReclaimed"`
	}
	json.Unmarshal(b, &r)
	return map[string]interface{}{
		"images_deleted":  len(r.ImagesDeleted),
		"space_reclaimed": r.SpaceReclaimed,
	}, nil
}

// ── Volume operations ──

type dockerVolumeList struct {
	Volumes []struct {
		Name       string  `json:"Name"`
		Driver     string  `json:"Driver"`
		Mountpoint string  `json:"Mountpoint"`
		CreatedAt  string  `json:"CreatedAt"`
		UsageData  *struct {
			Size int64 `json:"Size"`
		} `json:"UsageData"`
	} `json:"Volumes"`
}

func listVolumes() ([]VolumeResp, error) {
	b, err := dockerGet("/volumes")
	if err != nil {
		return nil, err
	}
	var raw dockerVolumeList
	if err := json.Unmarshal(b, &raw); err != nil {
		return nil, err
	}
	res := make([]VolumeResp, 0, len(raw.Volumes))
	for _, v := range raw.Volumes {
		sz := int64(0)
		if v.UsageData != nil {
			sz = v.UsageData.Size
		}
		res = append(res, VolumeResp{
			Name: v.Name, Driver: v.Driver, Mountpoint: v.Mountpoint,
			Size: sz, Created: v.CreatedAt,
		})
	}
	return res, nil
}

func createVolume(name, driver string) (interface{}, error) {
	v := struct {
		Name   string `json:"Name"`
		Driver string `json:"Driver"`
	}{name, driver}
	b, _ := json.Marshal(v)
	_, err := dockerPost("/volumes/create", strings.NewReader(string(b)))
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"success": true, "name": name}, nil
}

func removeVolume(name string) error {
	_, err := dockerDelete("/volumes/" + name + "?force=true")
	return err
}

func pruneVolumes() (interface{}, error) {
	b, err := dockerPost("/volumes/prune?filters=%7B%7D", nil)
	if err != nil {
		return nil, err
	}
	var r interface{}
	json.Unmarshal(b, &r)
	return r, nil
}

// ── Network operations ──

type dockerNetwork struct {
	ID         string `json:"Id"`
	Name       string `json:"Name"`
	Driver     string `json:"Driver"`
	Scope      string `json:"Scope"`
	Containers map[string]interface{} `json:"Containers"`
	Created    string `json:"Created"`
}

var protectedNetworks = map[string]bool{
	"bridge": true,
	"host":   true,
	"none":   true,
}

func listNetworks() ([]NetworkResp, error) {
	b, err := dockerGet("/networks")
	if err != nil {
		return nil, err
	}
	var raw []dockerNetwork
	if err := json.Unmarshal(b, &raw); err != nil {
		return nil, err
	}
	res := make([]NetworkResp, 0, len(raw))
	for _, n := range raw {
		if protectedNetworks[n.Name] {
			continue
		}
		nc := 0
		if n.Containers != nil {
			nc = len(n.Containers)
		}
		nid := n.ID
		if len(nid) > 12 {
			nid = nid[:12]
		}
		res = append(res, NetworkResp{
			ID: nid, Name: n.Name, Driver: n.Driver,
			Scope: n.Scope, Containers: nc,
		})
	}
	return res, nil
}

func removeNetwork(id string) error {
	_, err := dockerDelete("/networks/" + id)
	return err
}

func pruneNetworks() (interface{}, error) {
	b, err := dockerPost("/networks/prune?filters=%7B%7D", nil)
	if err != nil {
		return nil, err
	}
	var r interface{}
	json.Unmarshal(b, &r)
	return r, nil
}

// ── System prune ──

type pruneReport struct {
	ContainersDeleted []string `json:"ContainersDeleted,omitempty"`
	ImagesDeleted     []string `json:"ImagesDeleted,omitempty"`
	NetworksDeleted   []string `json:"NetworksDeleted,omitempty"`
	VolumesDeleted    []string `json:"VolumesDeleted,omitempty"`
	SpaceReclaimed    uint64   `json:"SpaceReclaimed"`
}

func systemPrune() (interface{}, error) {
	result := pruneReport{}

	// Prune containers
	if b, err := dockerPost("/containers/prune?filters=%7B%7D", nil); err == nil {
		var r struct {
			ContainersDeleted []string `json:"ContainersDeleted"`
			SpaceReclaimed    uint64   `json:"SpaceReclaimed"`
		}
		json.Unmarshal(b, &r)
		result.ContainersDeleted = r.ContainersDeleted
		result.SpaceReclaimed += r.SpaceReclaimed
	}

	// Prune images
	if b, err := dockerPost("/images/prune?filters=%7B%7D", nil); err == nil {
		var r struct {
			ImagesDeleted  []interface{} `json:"ImagesDeleted"`
			SpaceReclaimed uint64        `json:"SpaceReclaimed"`
		}
		json.Unmarshal(b, &r)
		for _, d := range r.ImagesDeleted {
			result.ImagesDeleted = append(result.ImagesDeleted, fmt.Sprintf("%v", d))
		}
		result.SpaceReclaimed += r.SpaceReclaimed
	}

	// Prune networks
	if b, err := dockerPost("/networks/prune?filters=%7B%7D", nil); err == nil {
		var r struct {
			NetworksDeleted []string `json:"NetworksDeleted"`
		}
		json.Unmarshal(b, &r)
		result.NetworksDeleted = r.NetworksDeleted
	}

	// Prune volumes
	if b, err := dockerPost("/volumes/prune?filters=%7B%7D", nil); err == nil {
		var r struct {
			VolumesDeleted  []string `json:"VolumesDeleted"`
			SpaceReclaimed  uint64   `json:"SpaceReclaimed"`
		}
		json.Unmarshal(b, &r)
		result.VolumesDeleted = r.VolumesDeleted
		result.SpaceReclaimed += r.SpaceReclaimed
	}

	return result, nil
}

// ── Stack operations ──

func listStacks() ([]StackResp, error) {
	ctrs, err := listContainers()
	if err != nil {
		return nil, err
	}

	stackMap := make(map[string]*StackResp)
	order := []string{}

	for _, c := range ctrs {
		stackName := c.Labels["com.docker.compose.project"]
		if stackName == "" {
			continue
		}

		if _, ok := stackMap[stackName]; !ok {
			stackMap[stackName] = &StackResp{Name: stackName, Services: []StackService{}, Status: "running"}
			order = append(order, stackName)
		}
		svcName := c.Labels["com.docker.compose.service"]
		if svcName == "" {
			svcName = c.Name
		}
		stackMap[stackName].Services = append(stackMap[stackName].Services, StackService{
			ID: c.ID[:12], Name: svcName, State: c.State,
		})
	}

	res := make([]StackResp, len(order))
	for i, name := range order {
		s := stackMap[name]
		s.Status = "stopped"
		for _, sv := range s.Services {
			if sv.State == "running" {
				s.Status = "running"
				break
			}
		}
		res[i] = *s
	}
	return res, nil
}

func deployStack(name, content string) error {
	dir := fmt.Sprintf("/opt/stacks/%s", name)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	fpath := filepath.Join(dir, "docker-compose.yml")
	if err := os.WriteFile(fpath, []byte(content), 0644); err != nil {
		return err
	}
	cmd := exec.Command("docker", "compose", "-p", name, "-f", fpath, "up", "-d")
	cmd.Dir = dir
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("%s: %s", strings.TrimSpace(err.Error()), strings.TrimSpace(string(out)))
	}
	return nil
}

func restartStack(name string) error {
	dir, err := getStackComposeDir(name)
	if err != nil {
		return err
	}
	cmd := exec.Command("docker", "compose", "-p", name, "up", "-d")
	cmd.Dir = dir
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("%s: %s", strings.TrimSpace(err.Error()), strings.TrimSpace(string(out)))
	}
	return nil
}

func updateStackImages(name string) error {
	dir, err := getStackComposeDir(name)
	if err != nil {
		return err
	}
	pull := exec.Command("docker", "compose", "-p", name, "pull")
	pull.Dir = dir
	if out, err := pull.CombinedOutput(); err != nil {
		return fmt.Errorf("pull failed: %s: %s", strings.TrimSpace(err.Error()), strings.TrimSpace(string(out)))
	}
	up := exec.Command("docker", "compose", "-p", name, "up", "-d")
	up.Dir = dir
	if out, err := up.CombinedOutput(); err != nil {
		return fmt.Errorf("up failed: %s: %s", strings.TrimSpace(err.Error()), strings.TrimSpace(string(out)))
	}
	return nil
}

func destroyStack(name string) error {
	dir, err := getStackComposeDir(name)
	if err != nil {
		return err
	}
	cmd := exec.Command("docker", "compose", "-p", name, "down", "--volumes", "--remove-orphans")
	cmd.Dir = dir
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("%s: %s", strings.TrimSpace(err.Error()), strings.TrimSpace(string(out)))
	}
	return nil
}

func stackComposeDir(name string) string {
	paths := []string{
		fmt.Sprintf("/opt/stacks/%s", name),
		fmt.Sprintf("/tmp/stacks/%s", name),
	}
	for _, p := range paths {
		if fi, err := os.Stat(filepath.Join(p, "docker-compose.yml")); err == nil && !fi.IsDir() {
			return p
		}
		if fi, err := os.Stat(filepath.Join(p, "compose.yaml")); err == nil && !fi.IsDir() {
			return p
		}
	}
	return fmt.Sprintf("/tmp/stacks/%s", name)
}

func getStackComposeDir(name string) (string, error) {
	b, err := dockerGet("/containers/json?all=true&filters=" + urlEncodeJSON(fmt.Sprintf(`{"label":{"com.docker.compose.project":["%s"]}}`, name)))
	if err == nil {
		var ctrs []dockerContainer
		json.Unmarshal(b, &ctrs)
		for _, c := range ctrs {
			if f, ok := c.Labels["com.docker.compose.project.config_files"]; ok && f != "" {
				first := strings.Split(f, ",")[0]
				return filepath.Dir(strings.TrimSpace(first)), nil
			}
		}
	}
	return stackComposeDir(name), nil
}

func readStackCompose(name string) (string, error) {
	b, err := dockerGet("/containers/json?all=true&filters=" + urlEncodeJSON(fmt.Sprintf(`{"label":{"com.docker.compose.project":["%s"]}}`, name)))
	if err == nil {
		var ctrs []dockerContainer
		json.Unmarshal(b, &ctrs)
		for _, c := range ctrs {
			if f, ok := c.Labels["com.docker.compose.project.config_files"]; ok && f != "" {
				first := strings.Split(f, ",")[0]
				content, err := os.ReadFile(strings.TrimSpace(first))
				if err == nil {
					return string(content), nil
				}
			}
		}
	}
	dir := stackComposeDir(name)
	content, err := os.ReadFile(filepath.Join(dir, "docker-compose.yml"))
	if err != nil {
		content, err = os.ReadFile(filepath.Join(dir, "compose.yaml"))
		if err != nil {
			return "", fmt.Errorf("Cannot read compose config for stack %q: %v", name, err)
		}
	}
	return string(content), nil
}

func writeStackCompose(name, content string) error {
	dir := stackComposeDir(name)
	if err := os.MkdirAll(dir, 0755); err != nil {
		dir = fmt.Sprintf("/tmp/stacks/%s", name)
		os.MkdirAll(dir, 0755)
	}
	fpath := filepath.Join(dir, "docker-compose.yml")
	return os.WriteFile(fpath, []byte(content), 0644)
}

func urlEncodeJSON(s string) string {
	// Simple URL encoding for Docker API query strings
	r := strings.NewReplacer(
		`"`, `\"`,
		` `, `%20`,
		`{`, `%7B`,
		`}`, `%7D`,
		`[`, `%5B`,
		`]`, `%5D`,
		`:`, `%3A`,
		`,`, `%2C`,
	)
	return r.Replace(s)
}
