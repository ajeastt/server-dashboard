# Server Dashboard

A self-hosted dashboard for Docker container management, Compose stack deployment, and real-time system monitoring.

## Quick Install (one-liner)

```bash
curl -sSL https://raw.githubusercontent.com/ajeastt/server-dashboard/main/install.sh | sudo bash
```

Opens at `http://your-server:3001`.

Custom port: `curl ... | sudo bash -s -- -p 8080`

## Manual Install

```bash
mkdir -p /opt/server-dashboard && cd /opt/server-dashboard
curl -sSL https://raw.githubusercontent.com/ajeastt/server-dashboard/main/compose.yaml --output compose.yaml
docker compose pull
docker compose up -d
```

## Updating

```bash
# Git install (what the script does):
cd /opt/server-dashboard && sudo git pull && sudo docker compose pull && sudo docker compose up -d

# Manual install:
cd /opt/server-dashboard && curl -sSL https://raw.githubusercontent.com/ajeastt/server-dashboard/main/compose.yaml --output compose.yaml && sudo docker compose pull && sudo docker compose up -d
```

## What it does

Adds these volumes to the container so it can manage your system:

- `/var/run/docker.sock` — Docker API access
- `/opt/stacks` — Docker Compose stack files (Dockge-compatible)
- `/` at `/host` — System monitoring and file browser
- `/opt/server-dashboard` — Config access

## Development

```bash
git clone https://github.com/ajeastt/server-dashboard.git
cd server-dashboard/client && npm install && npm run dev   # frontend :5173
cd server-dashboard/server && go run .                     # backend  :3001
```

## Tech

| Layer | |
|-------|------|
| Frontend | React, Vite, Tailwind, Recharts, CodeMirror, xterm.js |
| Backend | Go, Fiber, gopsutil |
| Deploy | GitHub Container Registry (`ghcr.io/ajeastt/server-dashboard`) |

## License

MIT
