# Feishu Claude Agent Service
# Multi-stage build for optimized image size

# ==============================================================================
# Stage 1: Build
# ==============================================================================
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# ==============================================================================
# Stage 2: Production
# ==============================================================================
FROM node:20-slim AS production

# Install Claude Code CLI (used for task execution)
# Note: The container needs access to Claude Code credentials.
# Mount your ~/.claude directory or set up authentication before running.
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://claude.ai/install.sh | bash && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r claude && useradd -r -g claude claude

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Create data directory for session persistence
RUN mkdir -p /app/data && chown -R claude:claude /app

# Switch to non-root user
USER claude

# Set default environment variables
ENV NODE_ENV=production
ENV AGENT_SESSION_PERSIST_PATH=/app/data/sessions.json
ENV LOG_LEVEL=info

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Default command: run agent service
CMD ["node", "dist/agent/index.js"]

# Expose no ports - this service uses WebSocket outbound connections only
# For MCP Server mode, use: CMD ["node", "dist/index.js"]
