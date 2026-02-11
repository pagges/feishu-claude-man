import { z } from 'zod';
import crypto from 'node:crypto';
import type { FeishuClient } from '../feishu-client.js';
import type { SessionManager } from '../session-manager.js';
import type { IpcClient } from '../ipc/client.js';
import { buildAskCard } from '../card-builder.js';

/**
 * Zod schema shape for the feishu_ask tool input.
 * Used directly by McpServer.tool() for parameter validation.
 */
export const askInputSchema = {
  question: z
    .string()
    .min(1, 'question is required')
    .max(4000, 'question must be at most 4000 characters')
    .describe('要向用户提问的内容'),
  timeoutMs: z
    .number()
    .int()
    .min(0, 'timeoutMs must be >= 0')
    .default(0)
    .describe('等待超时时间（毫秒），0 表示无超时'),
  userId: z
    .string()
    .optional()
    .describe('目标用户的飞书 Open ID'),
};

/**
 * MCP tool definition metadata for feishu_ask.
 */
export const ASK_TOOL_NAME = 'feishu_ask';
export const ASK_TOOL_DESCRIPTION =
  '向用户发送问题并等待飞书回复，收到回复后返回内容';

/**
 * Create the handler function for the feishu_ask MCP tool.
 *
 * Sends a question to a Feishu user, registers a pending question on a session,
 * and waits for the user's reply. Returns the reply content or an error on timeout.
 *
 * When WebSocket is not available (Agent holds it), falls back to IPC communication
 * with the Agent to forward the question and receive the reply.
 *
 * @param feishuClient - The FeishuClient instance for sending messages
 * @param sessionManager - The SessionManager for tracking pending questions
 * @param isWsEnabled - Callback that returns whether WebSocket is active
 * @param ipcClient - Optional IPC client for communicating with Agent
 * @returns An async handler compatible with McpServer.tool()
 */
export function createAskHandler(
  feishuClient: FeishuClient,
  sessionManager: SessionManager,
  isWsEnabled: () => boolean = () => true,
  ipcClient?: IpcClient,
) {
  return async (args: {
    question: string;
    timeoutMs: number;
    userId?: string;
  }) => {
    // If WebSocket is available, use direct path
    if (isWsEnabled()) {
      return handleDirectAsk(feishuClient, sessionManager, args);
    }

    // Try IPC to Agent if available
    if (ipcClient?.isAgentAvailable()) {
      console.error('[feishu_ask] WebSocket not available, trying IPC to Agent...');
      try {
        const result = await ipcClient.ask({
          question: args.question,
          userId: args.userId,
          timeoutMs: args.timeoutMs,
          mcpRequestId: crypto.randomUUID(),
        });

        if (result.success && result.reply) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `User replied:\n\n${result.reply}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text' as const,
                text: result.error || 'Unknown error from Agent',
              },
            ],
            isError: true,
          };
        }
      } catch (error) {
        console.error('[feishu_ask] IPC failed:', error);
        // Fall through to error message
      }
    }

    // Neither WebSocket nor IPC available
    return {
      content: [
        {
          type: 'text' as const,
          text:
            'feishu_ask 不可用：WebSocket 连接被占用且 Agent IPC 服务不可用。' +
            '请确保 Agent 服务正在运行，或改用终端标准交互（AskUserQuestion）。',
        },
      ],
      isError: true,
    };
  };
}

/**
 * Handle ask directly via WebSocket (when MCP holds the WebSocket lock).
 */
async function handleDirectAsk(
  feishuClient: FeishuClient,
  sessionManager: SessionManager,
  args: {
    question: string;
    timeoutMs: number;
    userId?: string;
  },
) {

  const targetUserId = args.userId ?? feishuClient.getDefaultUserId();

  if (!targetUserId) {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'Target user not configured. Set FEISHU_USER_ID or provide userId parameter',
        },
      ],
      isError: true,
    };
  }

  // Create a session for this ask interaction
  const session = sessionManager.createSession();

  try {
    // Send the question as an interactive card to Feishu
    const card = buildAskCard(args.question);
    const { messageId } = await feishuClient.sendCardMessage(
      targetUserId,
      card,
      args.question,
    );

    // Register the pending question and wait for a reply
    const reply = await sessionManager.registerPendingQuestion(session.id, {
      messageId,
      content: args.question,
      timeoutMs: args.timeoutMs > 0 ? args.timeoutMs : undefined,
    });

    // Send acknowledgment to let the user know their reply was received
    try {
      await feishuClient.sendMessage(
        targetUserId,
        '✅ 已收到你的回复，正在处理中...',
      );
    } catch {
      // Acknowledgment is best-effort; do not fail the ask if it fails
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `User replied:\n\n${reply}`,
        },
      ],
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    // Distinguish timeout from other errors
    const isTimeout = errorMessage.includes('Reply timeout');
    const displayMessage = isTimeout
      ? `Reply timeout (waited ${args.timeoutMs}ms). User did not reply on Feishu.`
      : `Failed to send question: ${errorMessage}`;

    return {
      content: [
        {
          type: 'text' as const,
          text: displayMessage,
        },
      ],
      isError: true,
    };
  } finally {
    // Clean up the session after the interaction completes
    sessionManager.destroySession(session.id);
  }
}
