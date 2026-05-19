# Server Dashboard

A self-hosted dashboard with Docker container management, Docker Compose stack deployment, and real-time system monitoring — all in one clean, modern dark-themed UI.

## Features

- **Dashboard** — Live CPU, memory, disk, and network graphs (WebSocket real-time)
- **Containers** — List, search, filter, start/stop/restart/pause containers with per-container stats, logs (from startup), and built-in terminal
- **Stacks** — Auto-discovers existing Docker Compose stacks, deploy new ones from YAML in the UI, edit with syntax highlighting, restart, destroy, update all images
- **Volumes** — List with disk mounts, create/remove/prune Docker volumes
- **Networks** — List, remove, prune Docker networks
- **File Browser** — Browse host filesystem, preview files
- **System Info** — Hostname, OS, kernel, uptime, CPU details
- **Prune** — Prune unused images or full system prune with space-reclaimed stats

## Quick Install

**Requirements:** Docker 20+ and Docker Compose V2 on a Linux server.

```bash
curl -sSL https://raw.githubusercontent.com/ajeastt/server-dashboard/main/install.sh | sudo bash
```

Open `http://your-server:3001`.

### Custom port or directory

```bash
curl -sSL https://raw.githubusercontent.com/ajeastt/server-dashboard/main/install.sh | sudo bash -s -- -p 8080 -d /opt/dash
```

## Manual Setup

```bash
mkdir -p /opt/server-dashboard && cd /opt/server-dashboard
curl -sSL https://raw.githubusercontent.com/ajeastt/server-dashboard/main/compose.yaml --output compose.yaml
docker compose pull && docker compose up -d
```

## Updating

```bash
cd /opt/server-dashboard
sudo git pull
sudo docker compose pull && sudo docker compose up -d
```

Or if you used the manual setup (no git repo):

```bash
cd /opt/server-dashboard
curl -sSL https://raw.githubusercontent.com/ajeastt/server-dashboard/main/compose.yaml --output compose.yaml
sudo docker compose pull && sudo docker compose up -d
```

## Development

```bash
git clone https://github.com/ajeastt/server-dashboard.git
cd server-dashboard

# Frontend
cd client && npm install && npm run dev

# Backend (in another terminal)
cd server && go run .
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, Tailwind CSS, Recharts, Lucide icons, CodeMirror 6, xterm.js |
| Backend | Go, Fiber, gopsutil, gorilla/websocket |
| Container | Docker Engine API (direct Unix socket), Docker Compose CLI |

## License

MIT
