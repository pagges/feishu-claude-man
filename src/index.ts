import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as lark from '@larksuiteoapi/node-sdk';

import { loadConfig } from './config.js';
import { SessionManager } from './session-manager.js';
import { MessageHistory } from './message-history.js';
import { FeishuClient } from './feishu-client.js';
import {
  cleanupStaleProcess,
  writePidFile,
  acquireWsLock,
  releaseWsLock,
  removePidFile,
  registerExitCleanup,
  MCP_PID_FILE,
} from './process-lock.js';
import { IpcClient } from './ipc/client.js';

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
  // 0. Process management: clean stale processes and write PID file
  await cleanupStaleProcess(MCP_PID_FILE);
  writePidFile(MCP_PID_FILE);

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

  // 5.5. Create IPC client for communicating with Agent (when Agent holds WebSocket)
  const ipcClient = new IpcClient();

  // 6. Register tools (with IPC fallback support)
  const notifyHandler = createNotifyHandler(feishuClient, ipcClient);
  server.tool(
    NOTIFY_TOOL_NAME,
    NOTIFY_TOOL_DESCRIPTION,
    notifyInputSchema,
    notifyHandler,
  );

  const askHandler = createAskHandler(feishuClient, sessionManager, () => wsEnabled, ipcClient);
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

  // 7. Try to acquire WebSocket lock and start event listener
  let wsEnabled = false;
  const wsLockAcquired = acquireWsLock('mcp');

  if (wsLockAcquired) {
    await feishuClient.startEventListener();
    wsEnabled = true;
    console.error('[feishu-bridge] Feishu WebSocket event listener started');
  } else {
    // Check if Agent IPC is available for fallback
    const agentAvailable = ipcClient.isAgentAvailable();
    if (agentAvailable) {
      console.error(
        '[feishu-bridge] WebSocket held by Agent, IPC available. ' +
          'feishu_ask and feishu_notify will use IPC to communicate with Agent.',
      );
    } else {
      console.error(
        '[feishu-bridge] WebSocket skipped and Agent IPC not available. ' +
          'feishu_notify works directly, feishu_ask will fall back to terminal.',
      );
    }
  }

  // 8. Register exit cleanup
  registerExitCleanup(MCP_PID_FILE, wsLockAcquired);

  // 9. Connect stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[feishu-bridge] MCP Server connected via stdio');

  // 10. Graceful shutdown handling
  const shutdown = async () => {
    console.error('[feishu-bridge] Shutting down...');
    if (wsLockAcquired) {
      releaseWsLock();
    }
    removePidFile(MCP_PID_FILE);
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
