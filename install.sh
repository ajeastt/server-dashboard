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
REPO_URL="https://github.com/ajeastt/server-dashboard"
RAW_URL="$REPO_URL/raw/main"
BUILD_LOCAL=false

# ── Help ──
usage() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Install Server Dashboard - a self-hosted Docker dashboard with monitoring."
  echo ""
  echo "Options:"
  echo "  -d, --dir DIR       Installation directory (default: /opt/server-dashboard)"
  echo "  -p, --port PORT     Web UI port (default: 3001)"
  echo "  -b, --build         Build from source instead of pulling pre-built image"
  echo "  -h, --help          Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0"
  echo "  $0 -p 8080"
  echo "  $0 -d /opt/dash -p 9000"
  echo "  $0 --build"
  exit 0
}

# ── Parse args ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    -d|--dir) INSTALL_DIR="$2"; shift 2 ;;
    -p|--port) PORT="$2"; shift 2 ;;
    -b|--build) BUILD_LOCAL=true; shift ;;
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
echo -e "  Build:     ${GREEN}$([[ $BUILD_LOCAL == true ]] && echo 'from source' || echo 'pull image')${NC}"
echo ""

# ── Checks ──
if ! command -v docker &>/dev/null; then
  echo -e "${RED}Error: Docker is not installed.${NC}"
  echo "Install Docker first: https://docs.docker.com/engine/install/"
  exit 1
fi

if ! docker compose version &>/dev/null && ! docker-compose --version &>/dev/null; then
  echo -e "${RED}Error: Docker Compose is not installed.${NC}"
  exit 1
fi

# ── Create install dir ──
echo -e "  ${BLUE}→${NC} Creating directory $INSTALL_DIR..."
sudo mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# ── Download compose.yaml ──
echo -e "  ${BLUE}→${NC} Downloading compose.yaml..."
sudo curl -sSL "$RAW_URL/compose.yaml" --output compose.yaml

# ── Apply custom port ──
if [[ "$PORT" != "3001" ]]; then
  echo -e "  ${BLUE}→${NC} Setting custom port $PORT..."
  if [[ "$(uname)" == "Darwin" ]]; then
    sudo sed -i '' "s/SERVERDASH_PORT:-3001/SERVERDASH_PORT:-$PORT/" compose.yaml
  else
    sudo sed -i "s/SERVERDASH_PORT:-3001/SERVERDASH_PORT:-$PORT/" compose.yaml
  fi
fi

# ── Build or pull ──
if [[ $BUILD_LOCAL == true ]]; then
  echo -e "  ${BLUE}→${NC} Cloning repository and building from source..."
  sudo git clone "$REPO_URL" /tmp/server-dashboard-build
  cd /tmp/server-dashboard-build
  sudo docker compose build
  cd "$INSTALL_DIR"
  sudo rm -rf /tmp/server-dashboard-build
else
  echo -e "  ${BLUE}→${NC} Pulling Docker image..."
fi

# ── Export port ──
export SERVERDASH_PORT="$PORT"

# ── Start ──
echo -e "  ${BLUE}→${NC} Starting Server Dashboard..."
sudo -E docker compose up -d

# ── Done ──
echo ""
echo -e "${GREEN}${BOLD}✓ Server Dashboard installed successfully!${NC}"
echo ""
echo -e "  Access it at: ${BOLD}http://localhost:$PORT${NC}"
echo ""
echo -e "  ${BLUE}Commands:${NC}"
echo -e "    View logs:  sudo docker compose -f $INSTALL_DIR/compose.yaml logs -f"
echo -e "    Update:     sudo docker compose -f $INSTALL_DIR/compose.yaml pull && sudo docker compose -f $INSTALL_DIR/compose.yaml up -d"
echo -e "    Stop:       sudo docker compose -f $INSTALL_DIR/compose.yaml down"
echo ""
