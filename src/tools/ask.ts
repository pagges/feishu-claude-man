import { z } from 'zod';
import type { FeishuClient } from '../feishu-client.js';
import type { SessionManager } from '../session-manager.js';
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
 * @param feishuClient - The FeishuClient instance for sending messages
 * @param sessionManager - The SessionManager for tracking pending questions
 * @param isWsEnabled - Callback that returns whether WebSocket is active
 * @returns An async handler compatible with McpServer.tool()
 */
export function createAskHandler(
  feishuClient: FeishuClient,
  sessionManager: SessionManager,
  isWsEnabled: () => boolean = () => true,
) {
  return async (args: {
    question: string;
    timeoutMs: number;
    userId?: string;
  }) => {
    // Fast-fail if WebSocket is not available (another service holds the connection)
    if (!isWsEnabled()) {
      return {
        content: [
          {
            type: 'text' as const,
            text:
              'feishu_ask 不可用：WebSocket 连接被 Agent 服务占用，无法接收飞书回复。' +
              '请改用终端标准交互（AskUserQuestion）向用户提问，或使用 feishu_notify 发送单向通知。',
          },
        ],
        isError: true,
      };
    }

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
  };
}
