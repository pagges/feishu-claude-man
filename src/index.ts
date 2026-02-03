import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as lark from '@larksuiteoapi/node-sdk';

import { loadConfig } from './config.js';
import { SessionManager } from './session-manager.js';
import { MessageHistory } from './message-history.js';
import { FeishuClient } from './feishu-client.js';

import {
  NOTIFY_TOOL_NAME,
  NOTIFY_TOOL_DESCRIPTION,
  notifyInputSchema,
  createNotifyHandler,
} from './tools/notify.js';
import {
  ASK_TOOL_NAME,
  ASK_TOOL_DESCRIPTION,
  askInputSchema,
  createAskHandler,
} from './tools/ask.js';
import {
  HISTORY_TOOL_NAME,
  HISTORY_TOOL_DESCRIPTION,
  historyInputSchema,
  createHistoryHandler,
} from './tools/history.js';

/**
 * Main entry point for the feishu-bridge MCP Server.
 *
 * Initializes all components, registers MCP tools, starts the Feishu
 * WebSocket event listener, and connects the MCP stdio transport.
 */
async function main(): Promise<void> {
  // 1. Load configuration from environment variables
  const config = loadConfig();

  // 2. Create core service instances
  const sessionManager = new SessionManager();
  const messageHistory = new MessageHistory();

  // 3. Create Feishu SDK Client
  const larkClient = new lark.Client({
    appId: config.appId,
    appSecret: config.appSecret,
  });

  // 4. Create FeishuClient instance
  const feishuClient = new FeishuClient({
    larkClient,
    sessionManager,
    messageHistory,
    config,
  });

  // 5. Create MCP Server
  const server = new McpServer({
    name: 'feishu-bridge',
    version: '1.0.0',
  });

  // 6. Register tools
  const notifyHandler = createNotifyHandler(feishuClient);
  server.tool(
    NOTIFY_TOOL_NAME,
    NOTIFY_TOOL_DESCRIPTION,
    notifyInputSchema,
    notifyHandler,
  );

  const askHandler = createAskHandler(feishuClient, sessionManager);
  server.tool(
    ASK_TOOL_NAME,
    ASK_TOOL_DESCRIPTION,
    askInputSchema,
    askHandler,
  );

  const historyHandler = createHistoryHandler(messageHistory);
  server.tool(
    HISTORY_TOOL_NAME,
    HISTORY_TOOL_DESCRIPTION,
    historyInputSchema,
    historyHandler,
  );

  // 7. Start Feishu WebSocket event listener
  await feishuClient.startEventListener();
  console.error('[feishu-bridge] Feishu WebSocket event listener started');

  // 8. Connect stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[feishu-bridge] MCP Server connected via stdio');

  // 9. Graceful shutdown handling
  const shutdown = async () => {
    console.error('[feishu-bridge] Shutting down...');
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  console.error('[feishu-bridge] Fatal error:', error);
  process.exit(1);
});
