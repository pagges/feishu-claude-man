import { z } from 'zod';
import type { FeishuClient } from '../feishu-client.js';
import type { IpcClient } from '../ipc/client.js';

/**
 * Zod schema shape for the feishu_notify tool input.
 * Used directly by McpServer.tool() for parameter validation.
 */
export const notifyInputSchema = {
  message: z
    .string()
    .min(1, 'message is required')
    .max(4000, 'message must be at most 4000 characters')
    .describe('要发送的消息内容，支持 Markdown 格式'),
  userId: z
    .string()
    .optional()
    .describe('目标用户的飞书 Open ID。不填则使用默认配置的用户'),
};

/**
 * MCP tool definition metadata for feishu_notify.
 */
export const NOTIFY_TOOL_NAME = 'feishu_notify';
export const NOTIFY_TOOL_DESCRIPTION =
  '向用户发送飞书私聊通知消息，发送后立即返回';

/**
 * Create the handler function for the feishu_notify MCP tool.
 *
 * Sends a text message to a Feishu user and returns a success or error result
 * in the MCP CallToolResult format.
 *
 * When MCP doesn't hold the WebSocket connection, falls back to IPC communication
 * with the Agent to forward the notification.
 *
 * @param feishuClient - The FeishuClient instance for sending messages
 * @param ipcClient - Optional IPC client for communicating with Agent
 * @returns An async handler compatible with McpServer.tool()
 */
export function createNotifyHandler(
  feishuClient: FeishuClient,
  ipcClient?: IpcClient,
) {
  return async (args: { message: string; userId?: string }) => {
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

    // Try direct send first
    try {
      const { messageId } = await feishuClient.sendMessage(
        targetUserId,
        args.message,
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: `Message sent successfully\nMessage ID: ${messageId}`,
          },
        ],
      };
    } catch (directError: unknown) {
      // If direct send fails and IPC is available, try IPC
      if (ipcClient?.isAgentAvailable()) {
        console.error('[feishu_notify] Direct send failed, trying IPC to Agent...');
        try {
          const result = await ipcClient.notify({
            message: args.message,
            userId: args.userId,
          });

          if (result.success) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Message sent via Agent\nMessage ID: ${result.messageId}`,
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Failed to send message via Agent: ${result.error}`,
                },
              ],
              isError: true,
            };
          }
        } catch (ipcError: unknown) {
          // IPC also failed, return original error
          console.error('[feishu_notify] IPC also failed:', ipcError);
        }
      }

      // Return original error
      const errorMessage =
        directError instanceof Error ? directError.message : String(directError);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to send message: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  };
}
