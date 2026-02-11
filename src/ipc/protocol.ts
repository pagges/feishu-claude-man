/**
 * IPC Protocol Definitions
 *
 * Defines the message types for communication between MCP Server and Agent Service
 * via Unix Domain Socket.
 */

/** Base message structure */
export interface IpcMessage {
  id: string; // UUID for request-response correlation
  type: 'request' | 'response';
  action: string;
}

// ============================================================================
// Ask Messages (MCP -> Agent -> MCP)
// ============================================================================

/** MCP -> Agent: Ask question request */
export interface AskRequest extends IpcMessage {
  type: 'request';
  action: 'ask';
  payload: {
    question: string;
    userId?: string;
    timeoutMs?: number;
    mcpRequestId: string; // Unique ID to track this ask request
  };
}

/** Agent -> MCP: Ask response */
export interface AskResponse extends IpcMessage {
  type: 'response';
  action: 'ask';
  payload: {
    mcpRequestId: string;
    success: boolean;
    reply?: string; // User's reply content
    error?: string; // Error message if failed
    messageId?: string; // Feishu message ID of the question
  };
}

// ============================================================================
// Notify Messages (MCP -> Agent -> MCP)
// ============================================================================

/** MCP -> Agent: Notify request (fire-and-forget style, but with ack) */
export interface NotifyRequest extends IpcMessage {
  type: 'request';
  action: 'notify';
  payload: {
    message: string;
    userId?: string;
  };
}

/** Agent -> MCP: Notify response (acknowledgment) */
export interface NotifyResponse extends IpcMessage {
  type: 'response';
  action: 'notify';
  payload: {
    success: boolean;
    messageId?: string;
    error?: string;
  };
}

// ============================================================================
// Error Response
// ============================================================================

/** Generic error response */
export interface ErrorResponse extends IpcMessage {
  type: 'response';
  action: 'error';
  payload: {
    error: string;
  };
}

// ============================================================================
// Type Guards
// ============================================================================

export type IpcRequest = AskRequest | NotifyRequest;
export type IpcResponse = AskResponse | NotifyResponse | ErrorResponse;

export function isAskRequest(msg: IpcMessage): msg is AskRequest {
  return msg.type === 'request' && msg.action === 'ask';
}

export function isNotifyRequest(msg: IpcMessage): msg is NotifyRequest {
  return msg.type === 'request' && msg.action === 'notify';
}

export function isAskResponse(msg: IpcMessage): msg is AskResponse {
  return msg.type === 'response' && msg.action === 'ask';
}

export function isNotifyResponse(msg: IpcMessage): msg is NotifyResponse {
  return msg.type === 'response' && msg.action === 'notify';
}
