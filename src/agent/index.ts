/**
 * Feishu Claude Agent Service
 *
 * A standalone service that listens for Feishu messages and executes
 * requests using Claude Agent SDK.
 */

import * as lark from '@larksuiteoapi/node-sdk';
import { loadAgentConfig } from './config.js';
import { AgentExecutor } from './agent-executor.js';
import { SessionStore } from './session-store.js';
import { MessageHandler } from './message-handler.js';
import type { ParsedMessageEvent } from './types.js';

/**
 * Feishu client wrapper for the agent service.
 */
class AgentFeishuClient {
  private readonly larkClient: lark.Client;
  private readonly config: ReturnType<typeof loadAgentConfig>;
  private wsClient?: lark.WSClient;
  private messageCallback?: (event: ParsedMessageEvent) => Promise<void>;

  constructor(config: ReturnType<typeof loadAgentConfig>) {
    this.config = config;
    this.larkClient = new lark.Client({
      appId: config.feishu.appId,
      appSecret: config.feishu.appSecret,
    });
  }

  /**
   * Send a text message to a user.
   */
  async sendMessage(userId: string, content: string): Promise<{ messageId: string }> {
    console.log(`[DEBUG] Sending message to ${userId}: ${content.substring(0, 50)}...`);
    try {
      const response = await this.larkClient.im.message.create({
        params: { receive_id_type: 'open_id' },
        data: {
          receive_id: userId,
          msg_type: 'text',
          content: JSON.stringify({ text: content }),
        },
      });

      console.log(`[DEBUG] Feishu API response: code=${response?.code}, msg=${response?.msg}`);

      const messageId = response?.data?.message_id;
      if (!messageId) {
        throw new Error(
          `Feishu API error: no message_id returned (code: ${response?.code}, msg: ${response?.msg})`,
        );
      }

      return { messageId };
    } catch (error) {
      console.error(`[DEBUG] Failed to send message:`, error);
      throw error;
    }
  }

  /**
   * Register a callback for incoming messages.
   */
  onMessage(callback: (event: ParsedMessageEvent) => Promise<void>): void {
    this.messageCallback = callback;
  }

  /**
   * Parse a raw Feishu message event.
   */
  private parseEvent(event: Record<string, unknown>): ParsedMessageEvent | null {
    try {
      const message = event.message as Record<string, unknown> | undefined;
      if (!message) return null;

      const messageType = (message.message_type as string) || 'unknown';

      // Extract text content
      let content = '';
      if (messageType === 'text') {
        const rawContent = message.content as string | undefined;
        if (rawContent) {
          try {
            const parsed = JSON.parse(rawContent) as { text?: string };
            content = parsed.text ?? '';
          } catch {
            content = rawContent;
          }
        }
      }

      // Extract sender info
      const sender = event.sender as Record<string, unknown> | undefined;
      const senderId = sender?.sender_id as Record<string, unknown> | undefined;
      const senderOpenId = (senderId?.open_id as string) || '';

      if (!senderOpenId) return null;

      return {
        senderId: senderOpenId,
        content,
        messageType,
        messageId: message.message_id as string | undefined,
        chatId: message.chat_id as string | undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Start listening for Feishu events.
   */
  async start(): Promise<void> {
    const dispatcher = new lark.EventDispatcher({}).register({
      'im.message.receive_v1': async (data: Record<string, unknown>) => {
        console.log('[DEBUG] Received im.message.receive_v1 event:', JSON.stringify(data).substring(0, 200));
        const event = this.parseEvent(data);
        if (event && this.messageCallback) {
          try {
            await this.messageCallback(event);
          } catch (error) {
            console.error('[AgentFeishuClient] Error handling message:', error);
          }
        } else {
          console.log('[DEBUG] Event parse failed or no callback:', { event, hasCallback: !!this.messageCallback });
        }
      },
    });

    this.wsClient = new lark.WSClient({
      appId: this.config.feishu.appId,
      appSecret: this.config.feishu.appSecret,
      loggerLevel: lark.LoggerLevel.debug,
    });

    await this.wsClient.start({ eventDispatcher: dispatcher });
  }

  /**
   * Stop the Feishu client.
   */
  async stop(): Promise<void> {
    // Note: The Lark SDK doesn't expose a stop method for WSClient
    // The process will need to be terminated
  }
}

/**
 * Main entry point for the agent service.
 */
async function main(): Promise<void> {
  console.log('🚀 Starting Feishu Claude Agent Service...');

  // Load configuration
  const config = loadAgentConfig();
  console.log(`📁 Working directory: ${config.agent.workingDirectory}`);
  console.log(`🔧 Allowed tools: ${config.agent.allowedTools.join(', ')}`);

  // Initialize components
  const feishuClient = new AgentFeishuClient(config);

  const sessionStore = new SessionStore(
    config.agent.sessionPersistPath || './data/agent-sessions.json',
  );
  console.log(`💾 Session store initialized (${sessionStore.size} existing sessions)`);

  const agentExecutor = new AgentExecutor(config.agent);

  const messageHandler = new MessageHandler(
    feishuClient,
    sessionStore,
    agentExecutor,
    config.agent,
  );

  // Register message handler
  feishuClient.onMessage(async (event) => {
    console.log(`📨 Received message from ${event.senderId}: ${event.content.substring(0, 50)}...`);
    await messageHandler.handle(event);
  });

  // Start Feishu event listener
  await feishuClient.start();
  console.log('✅ Feishu WebSocket connected, waiting for messages...');

  // Session cleanup interval (every hour)
  const cleanupInterval = setInterval(() => {
    const cleaned = sessionStore.cleanup(config.agent.sessionTimeoutMs);
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired sessions`);
    }
  }, 60 * 60 * 1000);

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log('\n🛑 Shutting down...');
    clearInterval(cleanupInterval);
    await feishuClient.stop();
    console.log('👋 Goodbye!');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Run if this is the main module
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
