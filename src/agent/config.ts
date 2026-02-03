/**
 * Configuration for the agent service.
 */

import { z } from 'zod';
import type { McpServerConfig } from './types.js';

/**
 * MCP server configuration schema.
 */
const McpServerConfigSchema = z.object({
  command: z.string(),
  args: z.array(z.string()),
  env: z.record(z.string(), z.string()).optional(),
});

/**
 * Zod schema for agent configuration.
 */
const AgentConfigSchema = z.object({
  feishu: z.object({
    appId: z.string().min(1, 'FEISHU_APP_ID is required'),
    appSecret: z.string().min(1, 'FEISHU_APP_SECRET is required'),
    defaultUserId: z.string().optional(),
  }),
  agent: z.object({
    workingDirectory: z.string(),
    allowedTools: z.array(z.string()),
    maxBudgetUsd: z.number().positive(),
    permissionMode: z.enum(['acceptEdits', 'plan', 'bypassPermissions']),
    allowedUsers: z.array(z.string()).optional(),
    sessionTimeoutMs: z.number().positive(),
    sessionPersistPath: z.string().optional(),
    mcpServers: z.record(z.string(), McpServerConfigSchema).optional(),
    model: z.string().optional(),
    claudePath: z.string(),
  }),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']),
});

export type FullAgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Default values for agent configuration.
 */
const DEFAULTS = {
  workingDirectory: process.cwd(),
  allowedTools: [
    'Read',
    'Write',
    'Edit',
    'Bash',
    'Glob',
    'Grep',
    'WebSearch',
    'WebFetch',
  ],
  maxBudgetUsd: 1.0,
  permissionMode: 'acceptEdits' as const,
  sessionTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours
  logLevel: 'info' as const,
  model: 'claude-opus-4-5-20251101', // Default to Opus 4.5
  claudePath: 'claude', // Default to 'claude' from PATH
};

/**
 * Load agent configuration from environment variables.
 *
 * Environment variables:
 *   Required:
 *     - FEISHU_APP_ID: Feishu application App ID
 *     - FEISHU_APP_SECRET: Feishu application App Secret
 *
 *   Optional:
 *     - FEISHU_USER_ID: Default target user Open ID
 *     - AGENT_WORKING_DIR: Working directory for agent execution
 *     - AGENT_MAX_BUDGET_USD: Maximum budget per task (default: 1.0)
 *     - AGENT_PERMISSION_MODE: Permission mode (default: acceptEdits)
 *     - AGENT_ALLOWED_USERS: Comma-separated list of allowed user IDs
 *     - AGENT_SESSION_TIMEOUT_MS: Session timeout in milliseconds
 *     - AGENT_SESSION_PERSIST_PATH: Path for session persistence file
 *     - AGENT_ALLOWED_TOOLS: Comma-separated list of allowed tools
 *     - AGENT_MODEL: Model to use (default: claude-opus-4-5-20251101)
 *     - AGENT_CLAUDE_PATH: Path to Claude CLI executable (default: 'claude')
 *     - LOG_LEVEL: Log level (default: info)
 */
export function loadAgentConfig(env: Record<string, string | undefined> = process.env): FullAgentConfig {
  // Parse allowed users from comma-separated string
  const allowedUsers = env.AGENT_ALLOWED_USERS
    ? env.AGENT_ALLOWED_USERS.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;

  // Parse allowed tools from comma-separated string
  const allowedTools = env.AGENT_ALLOWED_TOOLS
    ? env.AGENT_ALLOWED_TOOLS.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULTS.allowedTools;

  // Parse MCP servers from JSON if provided
  let mcpServers: Record<string, McpServerConfig> | undefined;
  if (env.AGENT_MCP_SERVERS) {
    try {
      mcpServers = JSON.parse(env.AGENT_MCP_SERVERS);
    } catch {
      console.warn('[Config] Failed to parse AGENT_MCP_SERVERS as JSON');
    }
  }

  // Parse permission mode
  const permissionModeRaw = env.AGENT_PERMISSION_MODE;
  const permissionMode =
    permissionModeRaw === 'acceptEdits' ||
    permissionModeRaw === 'plan' ||
    permissionModeRaw === 'bypassPermissions'
      ? permissionModeRaw
      : DEFAULTS.permissionMode;

  // Parse log level
  const logLevelRaw = env.LOG_LEVEL;
  const logLevel =
    logLevelRaw === 'debug' ||
    logLevelRaw === 'info' ||
    logLevelRaw === 'warn' ||
    logLevelRaw === 'error'
      ? logLevelRaw
      : DEFAULTS.logLevel;

  const raw = {
    feishu: {
      appId: env.FEISHU_APP_ID,
      appSecret: env.FEISHU_APP_SECRET,
      defaultUserId: env.FEISHU_USER_ID,
    },
    agent: {
      workingDirectory: env.AGENT_WORKING_DIR || DEFAULTS.workingDirectory,
      allowedTools,
      maxBudgetUsd: env.AGENT_MAX_BUDGET_USD
        ? parseFloat(env.AGENT_MAX_BUDGET_USD)
        : DEFAULTS.maxBudgetUsd,
      permissionMode,
      allowedUsers,
      sessionTimeoutMs: env.AGENT_SESSION_TIMEOUT_MS
        ? parseInt(env.AGENT_SESSION_TIMEOUT_MS, 10)
        : DEFAULTS.sessionTimeoutMs,
      sessionPersistPath: env.AGENT_SESSION_PERSIST_PATH,
      mcpServers,
      model: env.AGENT_MODEL || DEFAULTS.model,
      claudePath: env.AGENT_CLAUDE_PATH || DEFAULTS.claudePath,
    },
    logLevel,
  };

  return AgentConfigSchema.parse(raw);
}
