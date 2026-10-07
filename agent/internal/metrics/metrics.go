package metrics

import (
	"context"
	"math"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/shirou/gopsutil/v4/net"
)

type SystemInfo struct {
	TotalCPUs     int32
	TotalMemoryMB int64
	TotalDiskGB   float64
	OS            string
	KernelVersion string
}

type Snapshot struct {
	CPUPercent     float64
	MemoryUsedMB   int64
	DiskUsedGB     float64
	NetworkRxKBps  float64
	NetworkTxKBps  float64
	UptimeSeconds  int64
	Timestamp      int64
}

type Collector struct {
	mu          sync.Mutex
	lastNetTime time.Time
	lastRxBytes uint64
	lastTxBytes uint64
}

func NewCollector() *Collector {
	return &Collector{
		lastNetTime: time.Now(),
	}
}

// GetSystemInfo retrieves static host system specifications.
func (c *Collector) GetSystemInfo(ctx context.Context) SystemInfo {
	totalCPUs := int32(runtime.NumCPU())
	var totalMemMB int64
	var totalDiskGB float64
	osName := runtime.GOOS
	kernel := ""

	if vMem, err := mem.VirtualMemoryWithContext(ctx); err == nil {
		totalMemMB = int64(vMem.Total / (1024 * 1024))
	}

	if usage, err := disk.UsageWithContext(ctx, "/"); err == nil {
		totalDiskGB = math.Round(float64(usage.Total)/(1024*1024*1024)*100) / 100
	}

	if hInfo, err := host.InfoWithContext(ctx); err == nil {
		osName = hInfo.Platform + " " + hInfo.PlatformVersion
		kernel = hInfo.KernelVersion
	}

	// Prefer host /etc/os-release PRETTY_NAME if mounted
	if data, err := os.ReadFile("/etc/os-release"); err == nil {
		for _, line := range strings.Split(string(data), "\n") {
			if strings.HasPrefix(line, "PRETTY_NAME=") {
				val := strings.TrimPrefix(line, "PRETTY_NAME=")
				val = strings.Trim(val, `"'`)
				if val != "" {
					osName = val
					break
				}
			}
		}
	}

	return SystemInfo{
		TotalCPUs:     totalCPUs,
		TotalMemoryMB: totalMemMB,
		TotalDiskGB:   totalDiskGB,
		OS:            osName,
		KernelVersion: kernel,
	}
}

// Collect collects dynamic runtime system metrics.
func (c *Collector) Collect(ctx context.Context) Snapshot {
	now := time.Now()
	var cpuPct float64
	var memUsedMB int64
	var diskUsedGB float64
	var uptimeSec int64

	// CPU %
	if percentages, err := cpu.PercentWithContext(ctx, 0, false); err == nil && len(percentages) > 0 {
		cpuPct = math.Round(percentages[0]*100) / 100
	}

	// Memory MB
	if vMem, err := mem.VirtualMemoryWithContext(ctx); err == nil {
		memUsedMB = int64(vMem.Used / (1024 * 1024))
	}

	// Disk GB
	if dUsage, err := disk.UsageWithContext(ctx, "/"); err == nil {
		diskUsedGB = math.Round(float64(dUsage.Used)/(1024*1024*1024)*100) / 100
	}

	// Uptime
	if hInfo, err := host.InfoWithContext(ctx); err == nil {
		uptimeSec = int64(hInfo.Uptime)
	}

	// Network I/O rates
	rxRate, txRate := c.calculateNetRates(ctx, now)

	return Snapshot{
		CPUPercent:    cpuPct,
		MemoryUsedMB:  memUsedMB,
		DiskUsedGB:    diskUsedGB,
		NetworkRxKBps: rxRate,
		NetworkTxKBps: txRate,
		UptimeSeconds: uptimeSec,
		Timestamp:     now.Unix(),
	}
}

func (c *Collector) calculateNetRates(ctx context.Context, now time.Time) (float64, float64) {
	c.mu.Lock()
	defer c.mu.Unlock()

	counters, err := net.IOCountersWithContext(ctx, false)
	if err != nil || len(counters) == 0 {
		return 0, 0
	}

	totalRx := counters[0].BytesRecv
	totalTx := counters[0].BytesSent
	elapsed := now.Sub(c.lastNetTime).Seconds()

	var rxRate, txRate float64
	if elapsed > 0 && c.lastRxBytes > 0 {
		if totalRx >= c.lastRxBytes {
			rxRate = math.Round((float64(totalRx-c.lastRxBytes)/1024/elapsed)*100) / 100
		}
		if totalTx >= c.lastTxBytes {
			txRate = math.Round((float64(totalTx-c.lastTxBytes)/1024/elapsed)*100) / 100
		}
	}

	c.lastNetTime = now
	c.lastRxBytes = totalRx
	c.lastTxBytes = totalTx

	return rxRate, txRate
}
