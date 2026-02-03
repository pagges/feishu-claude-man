import { z } from 'zod';
import type { MessageHistory } from '../message-history.js';
import type { MessageRecord } from '../types.js';

/**
 * Zod schema shape for the feishu_history tool input.
 * Used directly by McpServer.tool() for parameter validation.
 */
export const historyInputSchema = {
  limit: z
    .number()
    .int()
    .min(1, 'limit must be at least 1')
    .max(100, 'limit must be at most 100')
    .default(20)
    .describe('返回的消息条数，默认 20，范围 1-100'),
};

/**
 * MCP tool definition metadata for feishu_history.
 */
export const HISTORY_TOOL_NAME = 'feishu_history';
export const HISTORY_TOOL_DESCRIPTION = '查询最近的消息交互历史';

/**
 * Format a single message record into a human-readable line.
 *
 * Format: [YYYY-MM-DD HH:mm:ss] -> Sent: content
 *     or: [YYYY-MM-DD HH:mm:ss] <- Received: content
 */
function formatRecord(record: MessageRecord): string {
  const date = new Date(record.timestamp);
  const timestamp = date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  const directionSymbol = record.direction === 'outgoing' ? '->' : '<-';
  const directionLabel = record.direction === 'outgoing' ? 'Sent' : 'Received';
  return `[${timestamp}] ${directionSymbol} ${directionLabel}: ${record.content}`;
}

/**
 * Create the handler function for the feishu_history MCP tool.
 *
 * Retrieves recent message history and formats it as readable text.
 *
 * @param messageHistory - The MessageHistory instance to query
 * @returns An async handler compatible with McpServer.tool()
 */
export function createHistoryHandler(messageHistory: MessageHistory) {
  return async (args: { limit: number }) => {
    const records = messageHistory.getRecent(args.limit);

    if (records.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No message history found.',
          },
        ],
      };
    }

    const formatted = records.map(formatRecord).join('\n');
    const header = `Recent ${records.length} message(s):\n`;

    return {
      content: [
        {
          type: 'text' as const,
          text: `${header}\n${formatted}`,
        },
      ],
    };
  };
}
