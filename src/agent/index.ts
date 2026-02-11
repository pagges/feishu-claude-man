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
import {
  buildSmartCard,
  needsCardFormat,
  type CardOptions,
} from '../smart-card-builder.js';
import {
  cleanupStaleProcess,
  writePidFile,
  acquireWsLock,
  releaseWsLock,
  removePidFile,
  registerExitCleanup,
  AGENT_PID_FILE,
  IPC_SOCKET_PATH,
} from '../process-lock.js';
import { IpcServer } from '../ipc/server.js';
import { PendingMcpQuestionRegistry } from './pending-mcp-questions.js';
import { buildAskCard } from '../smart-card-builder.js';
import {
  downloadResource,
  cleanupOldFiles,
  type ResourceType,
  type DownloadResult,
} from './file-downloader.js';
import {
  readFeishuDoc,
  findFeishuDocUrl,
  type DocReadResult,
} from './doc-reader.js';

/** Node in a Feishu post (rich text) paragraph. */
interface PostNode {
  tag: string;
  text?: string;
  href?: string;
  image_key?: string;
}

/** Feishu post (rich text) content structure. */
interface PostContent {
  title?: string;
  content?: PostNode[][];
}

/**
 * Feishu client wrapper for the agent service.
 */
class AgentFeishuClient {
  private readonly larkClient: lark.Client;
  private readonly config: ReturnType<typeof loadAgentConfig>;
  private wsClient?: lark.WSClient;
  private messageCallback?: (event: ParsedMessageEvent) => Promise<void>;
  /** 已处理的消息 ID 缓存，用于去重 */
  private readonly processedMessageIds = new Set<string>();
  /** 消息 ID 缓存最大数量 */
  private readonly maxProcessedIds = 1000;

  constructor(config: ReturnType<typeof loadAgentConfig>) {
    this.config = config;
    this.larkClient = new lark.Client({
      appId: config.feishu.appId,
      appSecret: config.feishu.appSecret,
    });
  }

  /**
   * Send a message to a user. Uses smart card for rich content, plain text for simple messages.
   */
  async sendMessage(
    userId: string,
    content: string,
    cardOptions?: CardOptions,
  ): Promise<{ messageId: string }> {
    console.log(`[DEBUG] Sending message to ${userId}: ${content.substring(0, 50)}...`);
    try {
      let msgType: string;
      let msgContent: string;

      if (needsCardFormat(content)) {
        // Use smart card for rich content
        msgType = 'interactive';
        const card = buildSmartCard(content, cardOptions);
        msgContent = JSON.stringify(card);
      } else {
        // Use plain text for very simple messages
        msgType = 'text';
        msgContent = JSON.stringify({ text: content });
      }

      const response = await this.larkClient.im.message.create({
        params: { receive_id_type: 'open_id' },
        data: {
          receive_id: userId,
          msg_type: msgType,
          content: msgContent,
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
   * Read a Feishu document by URL.
   */
  async readDoc(url: string): Promise<DocReadResult> {
    return readFeishuDoc(this.larkClient, url);
  }

  /**
   * Download a file or image resource from a Feishu message.
   */
  async downloadResource(
    messageId: string,
    fileKey: string,
    resourceType: ResourceType,
    originalFileName?: string,
  ): Promise<DownloadResult> {
    return downloadResource(
      this.larkClient,
      messageId,
      fileKey,
      resourceType,
      originalFileName,
    );
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

      // Extract content based on message type
      let content = '';
      let fileKey: string | undefined;
      let fileName: string | undefined;
      let imageKey: string | undefined;
      const rawContent = message.content as string | undefined;

      if (messageType === 'text') {
        if (rawContent) {
          try {
            const parsed = JSON.parse(rawContent) as { text?: string };
            content = parsed.text ?? '';
          } catch {
            content = rawContent;
          }
        }
      } else if (messageType === 'post') {
        // Rich text messages: extract text and image keys
        if (rawContent) {
          try {
            const parsed = JSON.parse(rawContent) as Record<string, PostContent>;
            // Post content is keyed by language (zh_cn, en_us, etc.)
            const postBody = Object.values(parsed)[0];
            if (postBody) {
              const textParts: string[] = [];
              const imageKeys: string[] = [];
              if (postBody.title) textParts.push(postBody.title);
              for (const paragraph of postBody.content || []) {
                for (const node of paragraph) {
                  if (node.tag === 'text' && node.text) {
                    textParts.push(node.text);
                  } else if (node.tag === 'a' && node.text) {
                    textParts.push(`${node.text}(${node.href || ''})`);
                  } else if (node.tag === 'img' && node.image_key) {
                    imageKeys.push(node.image_key);
                  }
                }
              }
              content = textParts.join('\n');
              // Use the first image if present
              if (imageKeys.length > 0) {
                imageKey = imageKeys[0];
              }
            }
          } catch {
            content = rawContent;
          }
        }
        if (!content) content = '[富文本消息]';
      } else if (messageType === 'image') {
        if (rawContent) {
          try {
            const parsed = JSON.parse(rawContent) as { image_key?: string };
            imageKey = parsed.image_key;
          } catch { /* ignore parse errors */ }
        }
        content = '[图片消息]';
      } else if (messageType === 'file') {
        if (rawContent) {
          try {
            const parsed = JSON.parse(rawContent) as { file_key?: string; file_name?: string };
            fileKey = parsed.file_key;
            fileName = parsed.file_name;
          } catch { /* ignore parse errors */ }
        }
        content = fileName ? `[文件消息] ${fileName}` : '[文件消息]';
      } else if (messageType === 'audio') {
        content = '[语音消息] 暂不支持语音，请发送文字';
      } else if (messageType === 'sticker') {
        content = '[表情消息]';
      } else {
        content = `[${messageType}消息] 暂不支持此类型，请发送文字`;
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
        fileKey,
        fileName,
        imageKey,
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if a message has already been processed (deduplication).
   */
  private isMessageProcessed(messageId: string | undefined): boolean {
    if (!messageId) return false;

    if (this.processedMessageIds.has(messageId)) {
      console.log(`[DEBUG] Duplicate message detected, skipping: ${messageId}`);
      return true;
    }

    // Add to processed set
    this.processedMessageIds.add(messageId);

    // Evict old entries if cache is too large
    if (this.processedMessageIds.size > this.maxProcessedIds) {
      const iterator = this.processedMessageIds.values();
      const firstValue = iterator.next().value;
      if (firstValue) {
        this.processedMessageIds.delete(firstValue);
      }
    }

    return false;
  }

  /**
   * Start listening for Feishu events.
   */
  async start(): Promise<void> {
    const dispatcher = new lark.EventDispatcher({}).register({
      'im.message.receive_v1': async (data: Record<string, unknown>) => {
        console.log('[DEBUG] Received im.message.receive_v1 event:', JSON.stringify(data).substring(0, 200));
        const event = this.parseEvent(data);

        // Deduplicate messages by messageId
        if (event && this.isMessageProcessed(event.messageId)) {
          return;
        }

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

  // 0. Process management: clean stale processes and write PID file
  await cleanupStaleProcess(AGENT_PID_FILE);
  writePidFile(AGENT_PID_FILE);

  // Load configuration
  const config = loadAgentConfig();
  console.log(`📁 Working directory: ${config.agent.workingDirectory}`);
  console.log(`🤖 Model: ${config.agent.model || 'default'}`);
  console.log(`🔧 Allowed tools: ${config.agent.allowedTools.join(', ')}`);

  // Initialize components
  const feishuClient = new AgentFeishuClient(config);

  const sessionStore = new SessionStore(
    config.agent.sessionPersistPath || './data/agent-sessions.json',
  );
  console.log(`💾 Session store initialized (${sessionStore.size} existing sessions)`);

  const agentExecutor = new AgentExecutor(config.agent);

  // Create pending MCP question registry
  const pendingMcpQuestions = new PendingMcpQuestionRegistry();

  // Create IPC server for MCP communication
  const ipcServer = new IpcServer();

  // Handle ask requests from MCP
  ipcServer.onAsk(async (req) => {
    const userId = req.userId || config.feishu.defaultUserId;
    if (!userId) {
      return {
        mcpRequestId: req.mcpRequestId,
        success: false,
        error: 'No user ID specified and no default user configured',
      };
    }

    try {
      // Build ask card and send to Feishu
      const card = buildAskCard(req.question);
      const cardContent = JSON.stringify(card);

      const response = await feishuClient.sendMessage(
        userId,
        `🤔 **Claude 需要你的确认**\n\n${req.question}\n\n💬 请直接回复文字`,
      );
      const messageId = response.messageId;

      console.log(`[IpcServer] Sent ask to Feishu, messageId=${messageId}, waiting for reply...`);

      // Register pending question and wait for reply
      const replyPromise = pendingMcpQuestions.register({
        mcpRequestId: req.mcpRequestId,
        feishuMessageId: messageId,
        question: req.question,
        userId,
        timeoutMs: req.timeoutMs,
      });

      // Wait for reply
      const reply = await replyPromise;

      console.log(`[IpcServer] Received reply for mcpRequestId=${req.mcpRequestId}`);

      return {
        mcpRequestId: req.mcpRequestId,
        success: true,
        reply,
        messageId,
      };
    } catch (error) {
      console.error(`[IpcServer] Ask failed:`, error);
      return {
        mcpRequestId: req.mcpRequestId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Handle notify requests from MCP
  ipcServer.onNotify(async (req) => {
    const userId = req.userId || config.feishu.defaultUserId;
    if (!userId) {
      return {
        success: false,
        error: 'No user ID specified and no default user configured',
      };
    }

    try {
      const response = await feishuClient.sendMessage(userId, req.message);
      return {
        success: true,
        messageId: response.messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // Start IPC server
  await ipcServer.start();
  console.log(`🔌 IPC server started at ${IPC_SOCKET_PATH}`);

  const messageHandler = new MessageHandler(
    feishuClient,
    sessionStore,
    agentExecutor,
    config.agent,
    { pendingMcpQuestions },
  );

  // Register message handler
  feishuClient.onMessage(async (event) => {
    console.log(`📨 Received message from ${event.senderId}: ${event.content.substring(0, 50)}...`);
    await messageHandler.handle(event);
  });

  // Acquire WebSocket lock (agent always force-acquires)
  const wsLockAcquired = acquireWsLock('agent');
  if (!wsLockAcquired) {
    // Should not happen since agent always force-acquires, but handle gracefully
    console.error('❌ Failed to acquire WebSocket lock');
    process.exit(1);
  }

  // Start Feishu event listener
  await feishuClient.start();
  console.log('✅ Feishu WebSocket connected, waiting for messages...');

  // Register exit cleanup
  registerExitCleanup(AGENT_PID_FILE, true);

  // Session and file cleanup interval (every hour)
  const cleanupInterval = setInterval(() => {
    const cleaned = sessionStore.cleanup(config.agent.sessionTimeoutMs);
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired sessions`);
    }
    cleanupOldFiles();
  }, 60 * 60 * 1000);

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log('\n🛑 Shutting down...');
    clearInterval(cleanupInterval);
    ipcServer.stop();
    releaseWsLock();
    removePidFile(AGENT_PID_FILE);
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
