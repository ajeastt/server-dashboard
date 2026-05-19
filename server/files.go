package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const fileRoot = "/host"

func safeResolve(userPath string) (string, error) {
	clean := filepath.Clean(fileRoot + userPath)
	if !strings.HasPrefix(clean, fileRoot) {
		return "", fmt.Errorf("Access denied: path traversal detected")
	}
	return clean, nil
}

func displayPath(abs string) string {
	if abs == fileRoot {
		return "/"
	}
	p := strings.TrimPrefix(abs, fileRoot)
	if p == "" {
		return "/"
	}
	return p
}

func listDirectory(userPath string) (*FileListResp, error) {
	target, err := safeResolve(userPath)
	if err != nil {
		return nil, err
	}

	entries, err := os.ReadDir(target)
	if err != nil {
		return nil, err
	}

	items := make([]FileEntry, 0, len(entries))
	for _, entry := range entries {
		fullPath := filepath.Join(target, entry.Name())
		info, err := os.Lstat(fullPath)
		if err != nil {
			continue
		}
		typ := "file"
		if info.IsDir() {
			typ = "directory"
		} else if info.Mode()&os.ModeSymlink != 0 {
			typ = "symlink"
		}
		items = append(items, FileEntry{
			Name:      entry.Name(),
			Path:      displayPath(fullPath),
			Size:      info.Size(),
			Mode:      fmt.Sprintf("%04o", info.Mode().Perm()),
			Mtime:     info.ModTime().UnixMilli(),
			Type:      typ,
			IsSymlink: info.Mode()&os.ModeSymlink != 0,
		})
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].Type == "directory" && items[j].Type != "directory" {
			return true
		}
		if items[i].Type != "directory" && items[j].Type == "directory" {
			return false
		}
		return strings.ToLower(items[i].Name) < strings.ToLower(items[j].Name)
	})

	current := displayPath(target)
	parent := ""
	if current != "/" {
		parent = filepath.Dir(current)
		if parent == "." {
			parent = "/"
		}
	}

	return &FileListResp{
		Path:   current,
		Parent: parent,
		Items:  items,
	}, nil
}

func readFileContent(userPath string) (*FileReadResp, error) {
	target, err := safeResolve(userPath)
	if err != nil {
		return nil, err
	}

	info, err := os.Stat(target)
	if err != nil {
		return nil, err
	}
	if info.IsDir() {
		return nil, fmt.Errorf("Cannot read a directory as file")
	}

	const maxSize = 10 * 1024 * 1024
	if info.Size() > maxSize {
		return nil, fmt.Errorf("File too large to preview (max 10 MB)")
	}

	ext := strings.ToLower(filepath.Ext(target))
	binaryExts := map[string]bool{
		".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".bmp": true,
		".ico": true, ".webp": true, ".svg": true, ".woff": true, ".woff2": true,
		".ttf": true, ".eot": true, ".pdf": true, ".zip": true, ".tar": true,
		".gz": true, ".bz2": true, ".xz": true, ".7z": true, ".rar": true,
		".o": true, ".so": true, ".dll": true, ".exe": true, ".wasm": true,
		".mp3": true, ".mp4": true, ".avi": true, ".mov": true, ".bin": true,
		".db": true, ".sqlite": true, ".parquet": true,
	}

	if binaryExts[ext] {
		return &FileReadResp{Binary: true}, nil
	}

	content, err := os.ReadFile(target)
	if err != nil {
		return &FileReadResp{Binary: true}, nil
	}

	// Quick check for binary content
	if isBinary(content) {
		return &FileReadResp{Binary: true}, nil
	}

	return &FileReadResp{Content: string(content), Binary: false, Encoding: "utf-8"}, nil
}

func isBinary(data []byte) bool {
	// Check first 8KB for null bytes
	checkLen := len(data)
	if checkLen > 8192 {
		checkLen = 8192
	}
	for _, b := range data[:checkLen] {
		if b == 0 {
			return true
		}
	}
	return false
}
