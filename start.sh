#!/usr/bin/env bash
# Feishu Claude Bridge - Startup Script
# Supports macOS and Linux

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Colors ────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { printf "${CYAN}[INFO]${NC} %s\n" "$*"; }
ok()    { printf "${GREEN}[OK]${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}[WARN]${NC} %s\n" "$*"; }
err()   { printf "${RED}[ERROR]${NC} %s\n" "$*"; }

# ── Usage ─────────────────────────────────────────────────
usage() {
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  claude (default)  Start Claude Code with Feishu MCP integration"
    echo "  agent             Start the Agent service (Feishu -> Claude)"
    echo "  mcp               Start the MCP Server standalone (for debugging)"
    echo ""
    echo "Options:"
    echo "  --kill-agent      Kill running agent before starting Claude Code"
    echo "  -h, --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                Start Claude Code with Feishu integration"
    echo "  $0 agent          Start Agent service (background/remote mode)"
    echo "  $0 --kill-agent   Kill agent first, then start Claude Code"
}

# ── Parse arguments ───────────────────────────────────────
MODE="claude"
KILL_AGENT=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        claude)         MODE="claude"; shift ;;
        agent)          MODE="agent"; shift ;;
        mcp)            MODE="mcp"; shift ;;
        --kill-agent)   KILL_AGENT=true; shift ;;
        -h|--help)      usage; exit 0 ;;
        *)              err "Unknown option: $1"; usage; exit 1 ;;
    esac
done

cd "$SCRIPT_DIR"

# ── Pre-flight checks ────────────────────────────────────

# Check if dist/ exists
if [ ! -d "$SCRIPT_DIR/dist" ]; then
    warn "dist/ not found. Building project..."
    npm run build
    ok "Build complete"
fi

# Check .env.agent
if [ ! -f "$SCRIPT_DIR/.env.agent" ]; then
    err ".env.agent not found. Run install.sh first."
    exit 1
fi

# ── Load .env.agent ───────────────────────────────────────
set -a
. "$SCRIPT_DIR/.env.agent"
set +a

# ── Helper: kill running agent ────────────────────────────
kill_agent_if_running() {
    local agent_pid=""
    local lock_file="/tmp/feishu-claude-ws.lock"
    local agent_pid_file="/tmp/feishu-claude-agent.pid"

    # Try PID file first
    if [ -f "$agent_pid_file" ]; then
        agent_pid=$(cat "$agent_pid_file" 2>/dev/null)
    fi

    # Also check lock file
    if [ -f "$lock_file" ]; then
        local lock_pid
        lock_pid=$(node -e "try{const l=JSON.parse(require('fs').readFileSync('$lock_file','utf8'));if(l.service==='agent')console.log(l.pid)}catch{}" 2>/dev/null)
        if [ -n "$lock_pid" ]; then
            agent_pid="$lock_pid"
        fi
    fi

    if [ -n "$agent_pid" ] && kill -0 "$agent_pid" 2>/dev/null; then
        info "Stopping agent service (PID $agent_pid)..."
        kill "$agent_pid" 2>/dev/null || true
        sleep 1
        # Force kill if still alive
        if kill -0 "$agent_pid" 2>/dev/null; then
            kill -9 "$agent_pid" 2>/dev/null || true
        fi
        ok "Agent service stopped"
    fi

    # Clean up lock and PID files
    rm -f "$lock_file" "$agent_pid_file" "/tmp/feishu-claude-mcp.pid"
}

# ── Ensure MCP is configured ─────────────────────────────
ensure_mcp_config() {
    local dist_entry="$SCRIPT_DIR/dist/index.js"
    local global_settings="$HOME/.claude/settings.json"

    # Check if MCP is already configured somewhere
    for settings_file in "$SCRIPT_DIR/.claude/settings.json" "$global_settings"; do
        if [ -f "$settings_file" ]; then
            if node -e "
const s = JSON.parse(require('fs').readFileSync('$settings_file','utf8'));
process.exit(s.mcpServers && s.mcpServers['feishu-bridge'] ? 0 : 1);
" 2>/dev/null; then
                return 0
            fi
        fi
    done

    # Not configured — add to global settings
    warn "MCP feishu-bridge not configured. Adding to $global_settings..."
    node -e "
const fs = require('fs');
const file = '$global_settings';
let settings = {};
try { settings = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
if (!settings.mcpServers) settings.mcpServers = {};
settings.mcpServers['feishu-bridge'] = {
    command: 'node',
    args: ['$dist_entry'],
    env: {
        FEISHU_APP_ID: process.env.FEISHU_APP_ID || '',
        FEISHU_APP_SECRET: process.env.FEISHU_APP_SECRET || '',
        FEISHU_USER_ID: process.env.FEISHU_USER_ID || ''
    }
};
fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
" && ok "MCP feishu-bridge configured in $global_settings"
}

# ── Start service ─────────────────────────────────────────
case "$MODE" in
    claude)
        # Kill agent if requested or if it's holding the WebSocket lock
        if [ "$KILL_AGENT" = true ]; then
            kill_agent_if_running
        else
            # Auto-detect: if agent is running, warn and offer to kill
            local_lock="/tmp/feishu-claude-ws.lock"
            if [ -f "$local_lock" ]; then
                lock_service=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('$local_lock','utf8')).service)}catch{}" 2>/dev/null)
                if [ "$lock_service" = "agent" ]; then
                    warn "Agent service is running and holds the WebSocket lock."
                    warn "feishu_ask will not work in Claude Code while agent is active."
                    info "Stopping agent to enable full Feishu integration..."
                    kill_agent_if_running
                fi
            fi
        fi

        # Ensure MCP is configured
        ensure_mcp_config

        echo ""
        info "Starting Claude Code with Feishu integration..."
        echo "  Working directory: $SCRIPT_DIR"
        echo "  MCP feishu-bridge will auto-load (feishu_ask + feishu_notify)"
        echo ""
        exec claude
        ;;
    agent)
        echo ""
        info "Starting Agent service (Feishu -> Claude)..."
        echo "  Working directory: $SCRIPT_DIR"
        echo "  Press Ctrl+C to stop"
        echo ""
        exec node --env-file=.env.agent dist/agent/index.js
        ;;
    mcp)
        echo ""
        info "Starting MCP Server standalone (for debugging)..."
        echo "  Press Ctrl+C to stop"
        echo ""
        exec node dist/index.js
        ;;
esac
