#!/bin/bash
# Installation script for Feishu Claude Agent Service
# Run as root or with sudo

set -e

APP_DIR="/opt/feishu-claude"
APP_USER="claude"
APP_GROUP="claude"

echo "=== Feishu Claude Agent Installation ==="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root or with sudo"
    exit 1
fi

# Create user and group if not exists
if ! id "$APP_USER" &>/dev/null; then
    echo "Creating user $APP_USER..."
    groupadd -r $APP_GROUP || true
    useradd -r -g $APP_GROUP -d $APP_DIR -s /sbin/nologin $APP_USER
fi

# Create application directory
echo "Creating application directory..."
mkdir -p $APP_DIR/data
chown -R $APP_USER:$APP_GROUP $APP_DIR

# Check if Node.js is installed
if ! command -v node &>/dev/null; then
    echo "Node.js not found. Please install Node.js 20 or later."
    echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -"
    echo "  apt-get install -y nodejs"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Node.js version must be 18 or later. Current: $(node -v)"
    exit 1
fi

# Install Claude Code CLI if not exists
if ! command -v claude &>/dev/null; then
    echo "Installing Claude Code CLI..."
    curl -fsSL https://claude.ai/install.sh | bash
fi

echo ""
echo "=== Next Steps ==="
echo "1. Copy your application files to $APP_DIR:"
echo "   cp -r dist package*.json $APP_DIR/"
echo ""
echo "2. Install dependencies:"
echo "   cd $APP_DIR && npm ci --only=production"
echo ""
echo "3. Create environment file:"
echo "   cp .env.agent.example $APP_DIR/.env"
echo "   # Edit $APP_DIR/.env with your credentials"
echo ""
echo "4. Install and start the service:"
echo "   cp deploy/feishu-claude-agent.service /etc/systemd/system/"
echo "   systemctl daemon-reload"
echo "   systemctl enable feishu-claude-agent"
echo "   systemctl start feishu-claude-agent"
echo ""
echo "5. Check status:"
echo "   systemctl status feishu-claude-agent"
echo "   journalctl -u feishu-claude-agent -f"
echo ""
echo "Installation complete!"
