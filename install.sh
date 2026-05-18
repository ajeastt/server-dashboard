#!/bin/bash
set -e

# ── Colors ──
BOLD='\033[1m'
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# ── Defaults ──
INSTALL_DIR="/opt/server-dashboard"
PORT="${SERVERDASH_PORT:-3001}"
REPO_URL="https://github.com/ajeastt/server-dashboard.git"

# ── Help ──
usage() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Install Server Dashboard - a self-hosted Docker dashboard with monitoring."
  echo ""
  echo "Options:"
  echo "  -d, --dir DIR       Installation directory (default: /opt/server-dashboard)"
  echo "  -p, --port PORT     Web UI port (default: 3001)"
  echo "  -h, --help          Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0"
  echo "  $0 -p 8080"
  echo "  $0 -d /opt/dash -p 9000"
  exit 0
}

# ── Parse args ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    -d|--dir) INSTALL_DIR="$2"; shift 2 ;;
    -p|--port) PORT="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo -e "${RED}Unknown option: $1${NC}"; usage ;;
  esac
done

# ── Intro ──
echo ""
echo -e "${BLUE}${BOLD}  ███████╗███████╗██████╗ ██╗   ██╗███████╗██████╗ ██████╗  █████╗ ███████╗██╗  ██╗${NC}"
echo -e "${BLUE}${BOLD}  ██╔════╝██╔════╝██╔══██╗██║   ██║██╔════╝██╔══██╗██╔══██╗██╔══██╗██╔════╝██║  ██║${NC}"
echo -e "${BLUE}${BOLD}  ███████╗█████╗  ██████╔╝██║   ██║█████╗  ██████╔╝██████╔╝███████║███████╗███████║${NC}"
echo -e "${BLUE}${BOLD}  ╚════██║██╔══╝  ██╔══██╗╚██╗ ██╔╝██╔══╝  ██╔══██╗██╔══██╗██╔══██║╚════██║██╔══██║${NC}"
echo -e "${BLUE}${BOLD}  ███████║███████╗██║  ██║ ╚████╔╝ ███████╗██║  ██║██║  ██║██║  ██║███████║██║  ██║${NC}"
echo -e "${BLUE}${BOLD}  ╚══════╝╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝${NC}"
echo ""
echo -e "${BOLD}Server Dashboard Installer${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Directory: ${GREEN}$INSTALL_DIR${NC}"
echo -e "  Port:      ${GREEN}$PORT${NC}"
echo ""

# ── Checks ──
if ! command -v docker &>/dev/null; then
  echo -e "${RED}Error: Docker is not installed.${NC}"
  echo "Install Docker first: https://docs.docker.com/engine/install/"
  exit 1
fi

if ! docker compose version &>/dev/null; then
  echo -e "${RED}Error: Docker Compose V2 is not installed.${NC}"
  exit 1
fi

if ! command -v git &>/dev/null; then
  echo -e "${RED}Error: git is not installed.${NC}"
  echo "Install git first, e.g.: apt install git"
  exit 1
fi

# ── Clone repo ──
echo -e "  ${BLUE}→${NC} Cloning repository..."
if [ -d "$INSTALL_DIR" ]; then
  echo -e "  ${BLUE}→${NC} Directory exists, updating..."
  cd "$INSTALL_DIR"
  sudo git pull
else
  sudo git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ── Apply custom port ──
if [[ "$PORT" != "3001" ]]; then
  echo -e "  ${BLUE}→${NC} Setting custom port $PORT..."
  if [[ "$(uname)" == "Darwin" ]]; then
    sudo sed -i '' "s/SERVERDASH_PORT:-3001/SERVERDASH_PORT:-$PORT/" compose.yaml
  else
    sudo sed -i "s/SERVERDASH_PORT:-3001/SERVERDASH_PORT:-$PORT/" compose.yaml
  fi
fi

# ── Build and start ──
echo -e "  ${BLUE}→${NC} Building and starting Server Dashboard..."
export SERVERDASH_PORT="$PORT"
sudo -E docker compose up -d --build

# ── Done ──
echo ""
echo -e "${GREEN}${BOLD}✓ Server Dashboard installed successfully!${NC}"
echo ""
echo -e "  Access it at: ${BOLD}http://localhost:$PORT${NC}"
echo ""
echo -e "  ${BLUE}Commands:${NC}"
echo -e "    View logs:  sudo docker compose -f $INSTALL_DIR/compose.yaml logs -f"
echo -e "    Update:     cd $INSTALL_DIR && sudo git pull && sudo docker compose up -d --build"
echo -e "    Stop:       sudo docker compose -f $INSTALL_DIR/compose.yaml down"
echo ""
