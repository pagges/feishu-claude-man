#!/usr/bin/env bash
# Feishu Claude Bridge - Installation Script
# Supports macOS and Linux

set -e

# ── Defaults ──────────────────────────────────────────────
AUTO_YES=false
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Colors ────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { printf "${CYAN}[INFO]${NC} %s\n" "$*"; }
ok()    { printf "${GREEN}[OK]${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}[WARN]${NC} %s\n" "$*"; }
err()   { printf "${RED}[ERROR]${NC} %s\n" "$*"; }

# ── Usage ─────────────────────────────────────────────────
usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -y, --yes       Skip confirmation prompts"
    echo "  -h, --help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0              Interactive install"
    echo "  $0 -y           Non-interactive install with defaults"
}

# ── Parse arguments ───────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        -y|--yes)     AUTO_YES=true; shift ;;
        -h|--help)    usage; exit 0 ;;
        *)            err "Unknown option: $1"; usage; exit 1 ;;
    esac
done

# ── Helper: prompt with default ───────────────────────────
ask() {
    local prompt="$1" default="$2" var_name="$3"
    if [ "$AUTO_YES" = true ] && [ -n "$default" ]; then
        eval "$var_name='$default'"
        return
    fi
    read -r -p "$(printf "${CYAN}?${NC} %s" "${prompt}")" input
    eval "$var_name='${input:-$default}'"
}

# ── Helper: yes/no prompt ─────────────────────────────────
confirm() {
    local prompt="$1" default="${2:-y}"
    if [ "$AUTO_YES" = true ]; then
        return 0
    fi
    local yn
    if [ "$default" = "y" ]; then
        read -r -p "$(printf "${CYAN}?${NC} %s [Y/n] " "${prompt}")" yn
        yn="${yn:-y}"
    else
        read -r -p "$(printf "${CYAN}?${NC} %s [y/N] " "${prompt}")" yn
        yn="${yn:-n}"
    fi
    [[ "$yn" =~ ^[Yy]$ ]]
}

echo ""
echo "============================================"
echo "  Feishu Claude Bridge - Installer"
echo "============================================"
echo ""

# ── Step 1: Check Node.js ────────────────────────────────
info "Checking Node.js..."
if ! command -v node &>/dev/null; then
    err "Node.js is not installed."
    echo "  Please install Node.js 18 or later:"
    echo "    macOS:  brew install node"
    echo "    Linux:  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && sudo apt-get install -y nodejs"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    err "Node.js >= 18 required. Current: $(node -v)"
    exit 1
fi
ok "Node.js $(node -v)"

# ── Step 2: Check Claude CLI ─────────────────────────────
info "Checking Claude CLI..."
if command -v claude &>/dev/null; then
    ok "Claude CLI found"
else
    warn "Claude CLI not found."
    echo "  Install it from: https://claude.ai/install.sh"
    echo "  Or run: curl -fsSL https://claude.ai/install.sh | bash"
    echo ""
    if confirm "Continue without Claude CLI?"; then
        warn "Skipping Claude CLI check. Agent service requires it to run."
    else
        exit 1
    fi
fi

# ── Step 3: Install dependencies ─────────────────────────
info "Installing dependencies..."
cd "$SCRIPT_DIR"
npm install
ok "Dependencies installed"

# ── Step 4: Build project ────────────────────────────────
info "Building project..."
npm run build
ok "Build complete"

# ── Step 5: Configure .env.agent ─────────────────────────
echo ""
info "Configuring environment variables..."

ENV_FILE="$SCRIPT_DIR/.env.agent"

if [ -f "$ENV_FILE" ]; then
    if ! confirm ".env.agent already exists. Overwrite?" "n"; then
        ok "Keeping existing .env.agent"
        # Read existing values for MCP config
        FEISHU_APP_ID=$(grep -E '^FEISHU_APP_ID=' "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || echo "")
        FEISHU_APP_SECRET=$(grep -E '^FEISHU_APP_SECRET=' "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || echo "")
        FEISHU_USER_ID=$(grep -E '^FEISHU_USER_ID=' "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || echo "")
    else
        CONFIGURE_ENV=true
    fi
else
    CONFIGURE_ENV=true
fi

if [ "${CONFIGURE_ENV:-false}" = true ]; then
    echo ""
    echo "  Enter your Feishu app credentials."
    echo "  (See README.md for how to create a Feishu app)"
    echo ""
    ask "  FEISHU_APP_ID: " "" FEISHU_APP_ID
    ask "  FEISHU_APP_SECRET: " "" FEISHU_APP_SECRET
    ask "  FEISHU_USER_ID (optional, press Enter to skip): " "" FEISHU_USER_ID

    if [ -z "$FEISHU_APP_ID" ] || [ -z "$FEISHU_APP_SECRET" ]; then
        err "FEISHU_APP_ID and FEISHU_APP_SECRET are required."
        exit 1
    fi

    cat > "$ENV_FILE" << EOF
# Feishu credentials
FEISHU_APP_ID=${FEISHU_APP_ID}
FEISHU_APP_SECRET=${FEISHU_APP_SECRET}
FEISHU_USER_ID=${FEISHU_USER_ID}
LOG_LEVEL=info
EOF

    ok ".env.agent created"
fi

# ── Step 6: Configure MCP ────────────────────────────────
echo ""
if confirm "Configure MCP Feishu notification for Claude Code?" "y"; then

    CLAUDE_JSON="$HOME/.claude.json"
    info "MCP config target: ~/.claude.json"

    # Use node to safely merge JSON config
    node -e "
const fs = require('fs');
const path = require('path');

const configFile = '$CLAUDE_JSON';
const projectDir = '$SCRIPT_DIR';
const appId = '${FEISHU_APP_ID}';
const appSecret = '${FEISHU_APP_SECRET}';
const userId = '${FEISHU_USER_ID}';

let config = {};
if (fs.existsSync(configFile)) {
    try {
        config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    } catch (e) {
        console.error('Warning: Failed to parse existing ~/.claude.json, creating new one.');
    }
}

if (!config.mcpServers) {
    config.mcpServers = {};
}

const env = {
    FEISHU_APP_ID: appId,
    FEISHU_APP_SECRET: appSecret,
};
if (userId) {
    env.FEISHU_USER_ID = userId;
}

config.mcpServers['feishu-bridge'] = {
    command: 'node',
    args: [path.join(projectDir, 'dist', 'index.js')],
    env: env,
};

fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n');
console.log('MCP configuration written to: ' + configFile);
"

    MCP_CONFIGURED=true
    ok "MCP Feishu notification configured"
else
    info "Skipped MCP configuration."
    echo "  You can configure it later by re-running: $0"
fi

# ── Step 7: Configure CLAUDE.md ──────────────────────────
if [ "${MCP_CONFIGURED:-false}" = true ]; then
    echo ""
    if confirm "Configure CLAUDE.md to make Claude prefer Feishu for communication?" "y"; then

        CLAUDE_MD="$HOME/.claude/CLAUDE.md"

        FEISHU_BLOCK='<!-- feishu-bridge-begin -->
## Feishu Communication

When the `feishu_ask` and `feishu_notify` MCP tools are available, follow these rules:

- **All confirmations and questions to the user**: Use `feishu_ask` instead of the built-in AskUserQuestion. This sends the question to the user'\''s Feishu and waits for their reply.
- **Progress notifications**: Use `feishu_notify` to inform the user of important milestones (task started, completed, errors encountered).
- **Fallback**: If `feishu_ask` returns an error (e.g., WebSocket unavailable), fall back to the built-in AskUserQuestion.
- **Do NOT** use `feishu_ask` for trivial internal decisions — only for questions that genuinely require user input.
<!-- feishu-bridge-end -->'

        if [ -f "$CLAUDE_MD" ]; then
            if grep -q "feishu-bridge-begin" "$CLAUDE_MD"; then
                # Replace existing feishu-bridge section
                node -e "
const fs = require('fs');
const file = '$CLAUDE_MD';
const block = \`$FEISHU_BLOCK\`;
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/<!-- feishu-bridge-begin -->[\s\S]*?<!-- feishu-bridge-end -->/, block);
fs.writeFileSync(file, content);
"
                ok "CLAUDE.md updated (replaced existing Feishu section)"
            else
                # Append to existing file
                printf '\n%s\n' "$FEISHU_BLOCK" >> "$CLAUDE_MD"
                ok "CLAUDE.md updated (appended Feishu section)"
            fi
        else
            printf '%s\n' "$FEISHU_BLOCK" > "$CLAUDE_MD"
            ok "CLAUDE.md created with Feishu communication rules"
        fi

        info "CLAUDE.md location: $CLAUDE_MD"
    else
        info "Skipped CLAUDE.md configuration."
    fi
fi

# ── Done ──────────────────────────────────────────────────
echo ""
echo "============================================"
printf "  ${GREEN}Installation complete!${NC}\n"
echo "============================================"
echo ""
echo "  Start Agent service:"
echo "    ./start.sh"
echo ""
echo "  Start MCP Server:"
echo "    ./start.sh mcp"
echo ""
echo "  For more info see README.md"
echo ""
