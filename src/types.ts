/**
 * Feishu application configuration.
 */
export interface FeishuConfig {
  /** Feishu application App ID */
  appId: string;
  /** Feishu application App Secret */
  appSecret: string;
  /** Default target user Open ID (optional, resolved at runtime via phone/email) */
  targetUserId?: string;
}

/**
 * A communication session between Claude Code and the MCP Server.
 */
export interface Session {
  /** Session ID (UUID) */
  id: string;
  /** Creation timestamp (epoch ms) */
  createdAt: number;
  /** The currently pending question awaiting a user reply, or null */
  pendingQuestion: PendingQuestion | null;
}

/**
 * A question that has been sent to the user and is awaiting a reply.
 */
export interface PendingQuestion {
  /** Question ID */
  id: string;
  /** Feishu message ID of the sent question */
  messageId: string;
  /** Question content text */
  content: string;
  /** Timestamp when the question was sent (epoch ms) */
  sentAt: number;
  /** Callback to resolve the waiting promise with the user's reply */
  resolve: (reply: string) => void;
  /** Optional timeout duration in milliseconds */
  timeoutMs?: number;
  /** Handle for the timeout timer, used for cleanup */
  timeoutTimer?: ReturnType<typeof setTimeout>;
}

/**
 * A recorded message in the interaction history.
 */
export interface MessageRecord {
  /** Record ID */
  id: string;
  /** Direction: outgoing = sent to user, incoming = received from user */
  direction: 'outgoing' | 'incoming';
  /** Message content text */
  content: string;
  /** Timestamp (epoch ms) */
  timestamp: number;
  /** Feishu message ID (if available) */
  feishuMessageId?: string;
  /** Sender's Feishu Open ID (for incoming messages) */
  senderOpenId?: string;
  /** Associated session ID (if available) */
  sessionId?: string;
}

/**
 * Input for the feishu_notify MCP tool.
 */
export interface NotifyInput {
  /** Message content (supports Markdown) */
  message: string;
  /** Target user Open ID (optional, falls back to configured default) */
  userId?: string;
}

/**
 * Output from the feishu_notify MCP tool.
 */
export interface NotifyOutput {
  /** Whether the message was sent successfully */
  success: boolean;
  /** Feishu message ID on success */
  messageId?: string;
  /** Error description on failure */
  error?: string;
}

/**
 * Input for the feishu_ask MCP tool.
 */
export interface AskInput {
  /** Question content to send to the user */
  question: string;
  /** Timeout in milliseconds (0 = no timeout) */
  timeoutMs?: number;
  /** Target user Open ID (optional, falls back to configured default) */
  userId?: string;
}

/**
 * Output from the feishu_ask MCP tool.
 */
export interface AskOutput {
  /** User's reply content */
  reply: string;
  /** Timestamp when the reply was received (epoch ms) */
  repliedAt: number;
}

/**
 * Input for the feishu_history MCP tool.
 */
export interface HistoryInput {
  /** Number of messages to return (default 20, max 100) */
  limit?: number;
}

/**
 * Output from the feishu_history MCP tool.
 */
export interface HistoryOutput {
  /** List of message records */
  messages: MessageRecord[];
}
