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

func runCmd(name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), fmt.Errorf("%s: %w\n%s", name, err, string(out))
	}
	return string(out), nil
}

func getUUID(part string) (string, error) {
	out, err := exec.Command("blkid", "-s", "UUID", "-o", "value", "/dev/"+part).Output()
	if err != nil {
		return "", fmt.Errorf("blkid: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}

func mountPath(name string) string {
	return filepath.Join(mountBase, name)
}

// FormatDevice formats a raw disk: unmount children → wipe → GPT → one ext4 partition → mount
func formatDevice(diskName, label string) (*FormatResult, error) {
	disk := "/dev/" + diskName
	children := getPartitions(diskName)

	// Step 1: unmount any mounted partitions
	for _, part := range children {
		if part.Mountpoint != "" {
			exec.Command("umount", "/dev/"+part.Name).Run()
		}
	}

	// Step 2: wipe the disk
	runCmd("wipefs", "-a", disk)

	// Step 3: create GPT partition table
	runCmd("parted", "-s", disk, "mklabel", "gpt")

	// Step 4: create single ext4 partition
	runCmd("parted", "-s", disk, "mkpart", "primary", "ext4", "0%", "100%")

	// Step 5: wait for partition to appear
	partName := diskName + "1"
	runCmd("partprobe", disk)

	// Step 6: create filesystem
	runCmd("mkfs.ext4", "-F", "-L", label, "/dev/"+partName)

	// Step 7: get UUID
	uuid, err := getUUID(partName)
	if err != nil {
		return nil, fmt.Errorf("get uuid: %w", err)
	}

	// Step 8: create mount point and mount
	mp := mountPath(label)
	os.MkdirAll(mp, 0755)
	_, err = runCmd("mount", "UUID="+uuid, mp)
	if err != nil {
		return nil, fmt.Errorf("mount: %w", err)
	}

	// Step 9: add to fstab with nofail
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
	cmd := exec.Command("lsblk", "-J", "-o", "NAME,TYPE,MOUNTPOINT")
	out, err := cmd.Output()
	if err != nil {
		return nil
	}
	var resp BlockDevicesResp
	if err := json.Unmarshal(out, &resp); err != nil {
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
	f, err := os.OpenFile("/etc/fstab", os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0644)
	if err != nil {
		return
	}
	defer f.Close()
	f.WriteString(entry)
}

func removeFromFstab(mountPath string) {
	data, err := os.ReadFile("/etc/fstab")
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
	os.WriteFile("/etc/fstab", []byte(strings.Join(filtered, "\n")), 0644)
}

// UnmountDevice unmounts and optionally removes the mount point and fstab entry
func unmountDevice(mountPath string) error {
	runCmd("umount", mountPath)
	removeFromFstab(mountPath)
	return nil
}

// ExistingMounts lists all CasaOS-managed mounts (by scanning our mount base)
func ListManagedMounts() ([]FormatResult, error) {
	entries, err := os.ReadDir(mountBase)
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
		// get UUID from mountinfo
		cmd := exec.Command("findmnt", "-n", "-o", "UUID,SOURCE", "--target", mp)
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
	mp := filepath.Join(mountBase, name)
	os.MkdirAll(mp, 0755)

	srcs := strings.Join(mountPoints, ":")
	opts := "defaults,allow_other,use_ino,category.create=mfs,nofail"

	_, err := runCmd("mergerfs", "-o", opts, srcs, mp)
	if err != nil {
		return fmt.Errorf("mergerfs mount: %w", err)
	}

	// Add to fstab
	entry := fmt.Sprintf("%s %s fuse.mergerfs %s 0 0\n", srcs, mp, opts)
	f, err := os.OpenFile("/etc/fstab", os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	f.WriteString(entry)

	return nil
}

// DestroyMergerFSPool unmounts and removes the pool
func DestroyMergerFSPool(name string) error {
	mp := filepath.Join(mountBase, name)
	runCmd("umount", mp)
	removeFromFstab(mp)
	os.RemoveAll(mp)
	return nil
}
