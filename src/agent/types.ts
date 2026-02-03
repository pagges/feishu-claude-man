/**
 * Agent service type definitions.
 */

/**
 * Configuration for the agent service.
 */
export interface AgentConfig {
  /** Working directory for Claude Agent execution */
  workingDirectory: string;
  /** List of tools available to the agent */
  allowedTools: string[];
  /** Maximum budget in USD per task */
  maxBudgetUsd: number;
  /** Permission mode: 'acceptEdits' | 'plan' | 'bypassPermissions' */
  permissionMode: 'acceptEdits' | 'plan' | 'bypassPermissions';
  /** Optional user whitelist (empty = allow all) */
  allowedUsers?: string[];
  /** Session timeout in milliseconds */
  sessionTimeoutMs: number;
  /** MCP servers configuration */
  mcpServers?: Record<string, McpServerConfig>;
  /** Model to use for Claude CLI (e.g., 'claude-opus-4-5-20251101') */
  model?: string;
  /** Path to Claude CLI executable (default: 'claude' from PATH) */
  claudePath: string;
}

/**
 * MCP server configuration.
 */
export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * Stored session information.
 */
export interface StoredSession {
  /** Session ID */
  id: string;
  /** User's Feishu Open ID */
  userId: string;
  /** Claude Agent SDK session ID for context resumption */
  claudeSessionId?: string;
  /** Session creation timestamp */
  createdAt: number;
  /** Last activity timestamp */
  lastActiveAt: number;
  /** Current session status */
  status: 'idle' | 'running' | 'cancelled';
}

/**
 * Result from agent execution.
 */
export interface AgentResult {
  /** Final result text */
  result?: string;
  /** Claude Agent SDK session ID */
  sessionId?: string;
}

/**
 * Parsed Feishu message event.
 */
export interface ParsedMessageEvent {
  /** Sender's Feishu Open ID */
  senderId: string;
  /** Message content */
  content: string;
  /** Message type */
  messageType: string;
  /** Feishu message ID */
  messageId?: string;
  /** Chat ID (for group messages) */
  chatId?: string;
}
