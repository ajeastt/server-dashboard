package main

import (
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

// ── System info ──

type SystemInfoResp struct {
	Hostname string `json:"hostname"`
	Platform string `json:"platform"`
	Distro   string `json:"distro"`
	Release  string `json:"release"`
	Kernel   string `json:"kernel"`
	Arch     string `json:"arch"`
	CPU      string `json:"cpu"`
	Uptime   uint64 `json:"uptime"`
}

func getSystemInfo() (*SystemInfoResp, error) {
	h, err := host.Info()
	if err != nil {
		return nil, err
	}
	c, err := cpu.Info()
	if err != nil || len(c) == 0 {
		c = []cpu.InfoStat{{}}
	}

	return &SystemInfoResp{
		Hostname: h.Hostname,
		Platform: h.Platform,
		Distro:   h.Platform,
		Release:  h.PlatformVersion,
		Kernel:   h.KernelVersion,
		Arch:     h.KernelArch,
		CPU:      c[0].ModelName,
		Uptime:   h.Uptime,
	}, nil
}

// ── Disks (via df to match Node behavior with /host mount) ──

func getDisks() ([]DiskResp, error) {
	cmd := exec.Command("df", "-B1", "--output=source,target,size,used,avail,pcent")
	out, err := cmd.Output()
	if err != nil {
		return getDisksFallback()
	}

	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	if len(lines) < 2 {
		return getDisksFallback()
	}

	type devInfo struct {
		source  string
		mount   string
		size    uint64
		used    uint64
		free    uint64
		percent float64
	}
	seen := make(map[string]*devInfo)

	for _, line := range lines[1:] {
		parts := strings.Fields(line)
		if len(parts) < 6 {
			continue
		}
		source := parts[0]
		if !strings.HasPrefix(source, "/dev/") || strings.HasPrefix(source, "/dev/loop") {
			continue
		}
		mount := parts[1]
		if mount == "/host" {
			mount = "/"
		} else if strings.HasPrefix(mount, "/host/") {
			mount = strings.TrimPrefix(mount, "/host")
		}

		size := parseUint64(parts[2])
		used := parseUint64(parts[3])
		free := parseUint64(parts[4])
		percent := parseFloat(parts[5])

		if existing, ok := seen[source]; ok {
			if len(mount) < len(existing.mount) {
				continue
			}
		}
		seen[source] = &devInfo{source, mount, size, used, free, percent}
	}

	res := make([]DiskResp, 0, len(seen))
	for _, d := range seen {
		res = append(res, DiskResp{
			FS:      d.source,
			Mount:   d.mount,
			Size:    d.size,
			Used:    d.used,
			Free:    d.free,
			Percent: d.percent,
		})
	}
	return res, nil
}

func getDisksFallback() ([]DiskResp, error) {
	parts, err := disk.Partitions(false)
	if err != nil {
		return nil, err
	}
	res := make([]DiskResp, 0, len(parts))
	for _, p := range parts {
		if !strings.HasPrefix(p.Device, "/dev/") || strings.HasPrefix(p.Device, "/dev/loop") {
			continue
		}
		usage, err := disk.Usage(p.Mountpoint)
		if err != nil {
			continue
		}
		res = append(res, DiskResp{
			FS:      p.Device,
			Mount:   p.Mountpoint,
			Size:    usage.Total,
			Used:    usage.Used,
			Free:    usage.Free,
			Percent: usage.UsedPercent,
		})
	}
	return res, nil
}

func parseUint64(s string) uint64 {
	var v uint64
	for _, c := range s {
		if c >= '0' && c <= '9' {
			v = v*10 + uint64(c-'0')
		}
	}
	return v
}

func parseFloat(s string) float64 {
	s = strings.TrimSuffix(s, "%")
	var v float64
	var div float64 = 1
	decPart := false
	for _, c := range s {
		if c >= '0' && c <= '9' {
			if decPart {
				div *= 10
				v = v + float64(c-'0')/div
			} else {
				v = v*10 + float64(c-'0')
			}
		} else if c == '.' {
			decPart = true
		}
	}
	return v
}

// ── Metrics streaming (WebSocket push) ──

type MetricsData struct {
	CPU        MetricsCPU        `json:"cpu"`
	Memory     MetricsMemory     `json:"memory"`
	Disk       []MetricsDisk     `json:"disk"`
	Network    MetricsNetwork    `json:"network"`
	Containers MetricsContainers `json:"containers"`
	Timestamp  int64             `json:"timestamp"`
}

type MetricsCPU struct {
	Usage float64 `json:"usage"`
	Cores int     `json:"cores"`
}

type MetricsMemory struct {
	Total   uint64  `json:"total"`
	Used    uint64  `json:"used"`
	Free    uint64  `json:"free"`
	Percent float64 `json:"percent"`
}

type MetricsDisk struct {
	FS      string  `json:"fs"`
	Size    uint64  `json:"size"`
	Used    uint64  `json:"used"`
	Free    uint64  `json:"free"`
	Percent float64 `json:"percent"`
	Mount   string  `json:"mount"`
}

type MetricsNetwork struct {
	Rx uint64 `json:"rx"`
	Tx uint64 `json:"tx"`
}

type MetricsContainers struct {
	Total   int `json:"total"`
	Running int `json:"running"`
	Stopped int `json:"stopped"`
}

var (
	metricsSubs     []chan<- *MetricsData
	metricsMu       sync.Mutex
	metricsRunning  bool
	metricsStopCh   chan struct{}
	prevNetCounters []net.IOCountersStat
	prevNetTime     time.Time
)

func startMetricsStream(send chan<- *MetricsData) func() {
	metricsMu.Lock()
	if !metricsRunning {
		metricsRunning = true
		metricsStopCh = make(chan struct{})
		// Get initial net counters
		prevNetCounters, _ = net.IOCounters(false)
		prevNetTime = time.Now()
		go metricsLoop()
	}
	metricsSubs = append(metricsSubs, send)
	metricsMu.Unlock()

	// Push initial metrics
	if data, err := collectMetrics(); err == nil {
		select {
		case send <- data:
		default:
		}
	}

	return func() {
		metricsMu.Lock()
		defer metricsMu.Unlock()
		for i, ch := range metricsSubs {
			if ch == send {
				metricsSubs = append(metricsSubs[:i], metricsSubs[i+1:]...)
				break
			}
		}
		if len(metricsSubs) == 0 && metricsRunning {
			metricsRunning = false
			close(metricsStopCh)
		}
	}
}

func metricsLoop() {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			data, err := collectMetrics()
			if err != nil {
				continue
			}
			metricsMu.Lock()
			for _, ch := range metricsSubs {
				select {
				case ch <- data:
				default:
				}
			}
			metricsMu.Unlock()
		case <-metricsStopCh:
			return
		}
	}
}

func collectMetrics() (*MetricsData, error) {
	// CPU
	cpuPercents, _ := cpu.Percent(0, false)
	cpuUsage := 0.0
	if len(cpuPercents) > 0 {
		cpuUsage = round2(cpuPercents[0])
	}
	cpuInfo, _ := cpu.Counts(true)

	// Memory
	memInfo, _ := mem.VirtualMemory()
	memPct := 0.0
	memTotal := uint64(0)
	memUsed := uint64(0)
	memFree := uint64(0)
	if memInfo != nil {
		memTotal = memInfo.Total
		memUsed = memInfo.Used
		memFree = memInfo.Free
		memPct = round2(memInfo.UsedPercent)
	}

	// Disk
	diskList := []MetricsDisk{}
	parts, _ := disk.Partitions(false)
	for _, p := range parts {
		if !strings.HasPrefix(p.Device, "/dev/") || strings.HasPrefix(p.Device, "/dev/loop") {
			continue
		}
		usage, err := disk.Usage(p.Mountpoint)
		if err != nil {
			continue
		}
		diskList = append(diskList, MetricsDisk{
			FS:      p.Device,
			Size:    usage.Total,
			Used:    usage.Used,
			Free:    usage.Free,
			Percent: round2(usage.UsedPercent),
			Mount:   p.Mountpoint,
		})
	}

	// Network delta
	now := time.Now()
	currCounters, _ := net.IOCounters(false)
	var rx, tx uint64
	if len(prevNetCounters) > 0 && len(currCounters) > 0 && !prevNetTime.IsZero() {
		elapsed := now.Sub(prevNetTime).Seconds()
		if elapsed > 0 {
			rx = uint64(float64(currCounters[0].BytesRecv-prevNetCounters[0].BytesRecv) / elapsed)
			tx = uint64(float64(currCounters[0].BytesSent-prevNetCounters[0].BytesSent) / elapsed)
		}
	}
	prevNetCounters = currCounters
	prevNetTime = now

	// Containers
	ctrs, _ := listContainers()
	total := len(ctrs)
	running := 0
	stopped := 0
	for _, c := range ctrs {
		switch c.State {
		case "running":
			running++
		case "exited":
			stopped++
		}
	}

	return &MetricsData{
		CPU:    MetricsCPU{Usage: cpuUsage, Cores: cpuInfo},
		Memory: MetricsMemory{Total: memTotal, Used: memUsed, Free: memFree, Percent: memPct},
		Disk:   diskList,
		Network: MetricsNetwork{Rx: rx, Tx: tx},
		Containers: MetricsContainers{Total: total, Running: running, Stopped: stopped},
		Timestamp:  now.UnixMilli(),
	}, nil
}
