package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const mountBase = "/var/lib/casaos/volumes"

type FormatProgress struct {
	Device  string `json:"device"`
	Step    string `json:"step"`
	Done    bool   `json:"done"`
	Error   string `json:"error,omitempty"`
}

type FormatResult struct {
	Device      string `json:"device"`
	Partition   string `json:"partition"`
	UUID        string `json:"uuid"`
	MountPoint  string `json:"mountPoint"`
}

type PoolInfo struct {
	Name       string   `json:"name"`
	MountPoint string   `json:"mountPoint"`
	Devices    []string `json:"devices"`
	Size       uint64   `json:"size"`
	Used       uint64   `json:"used"`
	Free       uint64   `json:"free"`
}

func hostRun(args ...string) (string, error) {
	cmd := exec.Command("chroot", append([]string{"/host"}, args...)...)
	out, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

func getUUID(part string) (string, error) {
	out, err := hostRun("blkid", "-s", "UUID", "-o", "value", "/dev/"+part)
	if err != nil {
		return "", fmt.Errorf("blkid: %w", err)
	}
	return strings.TrimSpace(out), nil
}

func mountPath(name string) string {
	return filepath.Join(mountBase, name)
}

// FormatDevice formats a raw disk: unmount children → wipe → GPT → one ext4 partition → mount
func formatDevice(diskName, label string) (*FormatResult, error) {
	disk := "/dev/" + diskName
	children := getPartitions(diskName)

	// Step 1: unmount any mounted partitions on the host
	for _, part := range children {
		if part.Mountpoint != "" {
			hostRun("umount", "/dev/"+part.Name)
		}
	}

	// Step 2: wipe the disk
	hostRun("wipefs", "-a", disk)

	// Step 3: create GPT partition table
	hostRun("parted", "-s", disk, "mklabel", "gpt")

	// Step 4: create single ext4 partition
	hostRun("parted", "-s", disk, "mkpart", "primary", "ext4", "0%", "100%")

	// Step 5: wait for partition to appear
	partName := diskName + "1"
	hostRun("partprobe", disk)

	// Step 6: create filesystem
	hostRun("mkfs.ext4", "-F", "-L", label, "/dev/"+partName)

	// Step 7: get UUID
	uuid, err := getUUID(partName)
	if err != nil {
		return nil, fmt.Errorf("get uuid: %w", err)
	}

	// Step 8: create mount point and mount on host
	mp := mountPath(label)
	hostRun("mkdir", "-p", mp)
	_, err = hostRun("mount", "UUID="+uuid, mp)
	if err != nil {
		return nil, fmt.Errorf("mount: %w", err)
	}

	// Step 9: add to host fstab with nofail
	addToFstab(uuid, mp, label)

	return &FormatResult{
		Device:     diskName,
		Partition:  partName,
		UUID:       uuid,
		MountPoint: mp,
	}, nil
}

type PartitionInfo struct {
	Name       string
	Mountpoint string
}

func getPartitions(diskName string) []PartitionInfo {
	out, err := hostRun("lsblk", "-J", "-o", "NAME,TYPE,MOUNTPOINT")
	if err != nil {
		return nil
	}
	var resp BlockDevicesResp
	if err := json.Unmarshal([]byte(out), &resp); err != nil {
		return nil
	}
	for _, d := range resp.BlockDevices {
		if d.Name == diskName {
			var parts []PartitionInfo
			for _, c := range d.Children {
				parts = append(parts, PartitionInfo{Name: c.Name, Mountpoint: c.Mountpoint})
			}
			return parts
		}
	}
	return nil
}

func addToFstab(uuid, mountPath, label string) {
	entry := fmt.Sprintf("UUID=%s %s ext4 defaults,nofail 0 2\n", uuid, mountPath)
	f, err := os.OpenFile("/host/etc/fstab", os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0644)
	if err != nil {
		return
	}
	defer f.Close()
	f.WriteString(entry)
}

func removeFromFstab(mountPath string) {
	data, err := os.ReadFile("/host/etc/fstab")
	if err != nil {
		return
	}
	lines := strings.Split(string(data), "\n")
	var filtered []string
	for _, line := range lines {
		if strings.Contains(line, mountPath) {
			continue
		}
		filtered = append(filtered, line)
	}
	os.WriteFile("/host/etc/fstab", []byte(strings.Join(filtered, "\n")), 0644)
}

// UnmountDevice unmounts and removes the mount point and fstab entry on the host
func unmountDevice(mountPath string) error {
	hostRun("umount", mountPath)
	removeFromFstab(mountPath)
	return nil
}

// ExistingMounts lists all CasaOS-managed mounts (by scanning our mount base on the host)
func ListManagedMounts() ([]FormatResult, error) {
	entries, err := os.ReadDir("/host" + mountBase)
	if err != nil {
		if os.IsNotExist(err) {
			return []FormatResult{}, nil
		}
		return nil, err
	}
	var results []FormatResult
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		mp := filepath.Join(mountBase, e.Name())
		cmd := exec.Command("chroot", "/host", "findmnt", "-n", "-o", "UUID,SOURCE", "--target", mp)
		out, err := cmd.Output()
		if err != nil {
			continue
		}
		fields := strings.Fields(string(out))
		if len(fields) < 2 {
			continue
		}
		uuid := fields[0]
		source := fields[1]
		partName := strings.TrimPrefix(source, "/dev/")
		diskName := strings.TrimRight(partName, "0123456789")
		results = append(results, FormatResult{
			Device:     diskName,
			Partition:  partName,
			UUID:       uuid,
			MountPoint: mp,
		})
	}
	return results, nil
}

// CreateMergerFSPool creates a mergerfs pool from multiple mount points
func CreateMergerFSPool(name string, mountPoints []string) error {
	mp := mountPath(name)
	hostRun("mkdir", "-p", mp)

	srcs := strings.Join(mountPoints, ":")
	opts := "defaults,allow_other,use_ino,category.create=mfs,nofail"

	_, err := hostRun("mergerfs", "-o", opts, srcs, mp)
	if err != nil {
		return fmt.Errorf("mergerfs mount: %w", err)
	}

	// Add to fstab
	entry := fmt.Sprintf("%s %s fuse.mergerfs %s 0 0\n", srcs, mp, opts)
	f, err := os.OpenFile("/host/etc/fstab", os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	f.WriteString(entry)

	return nil
}

// DestroyMergerFSPool unmounts and removes the pool
func DestroyMergerFSPool(name string) error {
	mp := mountPath(name)
	hostRun("umount", mp)
	removeFromFstab(mp)
	hostRun("rm", "-rf", mp)
	return nil
}

// EnsureMergerFSInstalled checks and installs mergerfs on the host
func EnsureMergerFSInstalled() error {
	if _, err := hostRun("which", "mergerfs"); err == nil {
		return nil
	}
	// Try to copy mergerfs from container to host
	if _, err := os.Stat("/usr/bin/mergerfs"); err == nil {
		data, err := os.ReadFile("/usr/bin/mergerfs")
		if err != nil {
			return fmt.Errorf("read local mergerfs: %w", err)
		}
		if err := os.WriteFile("/host/usr/local/bin/mergerfs", data, 0755); err != nil {
			return fmt.Errorf("copy mergerfs to host: %w", err)
		}
		// Verify it works on the host
		if _, err := hostRun("which", "mergerfs"); err != nil {
			return fmt.Errorf("mergerfs not accessible on host after copy: %w", err)
		}
		return nil
	}
	// Try dnf as fallback
	_, err := hostRun("dnf", "install", "-y", "mergerfs")
	return err
}
