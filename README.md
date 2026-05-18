# Server Dashboard

A self-hosted dashboard with Docker container management, Docker Compose stack deployment, and real-time system monitoring — all in one clean, modern UI.

## Features

- **Dashboard** — Live CPU, memory, disk, and network graphs (WebSocket real-time)
- **Containers** — List, search, filter, start/stop/restart/pause containers with per-container stats and logs
- **Stacks** — Auto-discovers existing Docker Compose stacks, deploy new ones from YAML in the UI, destroy stacks
- **System Info** — Hostname, OS, kernel, uptime, CPU details

## Screenshots

*(add screenshots here)*

## Quick Install

**Requirements:** Docker 20+ and Docker Compose V2 on a Linux server.

```bash
curl -sSL https://raw.githubusercontent.com/ajeastt/server-dashboard/main/install.sh | sudo bash
```

That's it. Open `http://your-server:3001`.

### Custom port or directory

```bash
curl -sSL https://raw.githubusercontent.com/ajeastt/server-dashboard/main/install.sh | sudo bash -s -- -p 8080 -d /opt/dash
```

### Build from source

```bash
curl -sSL https://raw.githubusercontent.com/ajeastt/server-dashboard/main/install.sh | sudo bash -s -- --build
```

## Manual Setup

```bash
mkdir -p /opt/server-dashboard && cd /opt/server-dashboard
curl -sSL https://raw.githubusercontent.com/ajeastt/server-dashboard/main/compose.yaml --output compose.yaml
docker compose up -d
```

## Development

```bash
git clone https://github.com/ajeastt/server-dashboard.git
cd server-dashboard
npm run install:all
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Updating

```bash
cd /opt/server-dashboard
docker compose pull && docker compose up -d
```

Or if using `--build`:

```bash
cd /opt/server-dashboard
curl -sSL https://raw.githubusercontent.com/ajeastt/server-dashboard/main/compose.yaml --output compose.yaml
docker compose up -d --build
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, Tailwind CSS, Recharts, Lucide icons |
| Backend | Node.js, Express, Dockerode, ws |
| Monitoring | systeminformation, Docker stats API |
| Container | Docker, Docker Compose |

## License

MIT
