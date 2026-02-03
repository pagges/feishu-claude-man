import * as lark from '@larksuiteoapi/node-sdk';
import type { Config } from './config.js';
import type { MessageHistory } from './message-history.js';
import type { SessionManager } from './session-manager.js';

/**
 * Options for constructing a FeishuClient.
 */
export interface FeishuClientOptions {
  /** Feishu SDK Client instance for REST API calls */
  larkClient: lark.Client;
  /** Session manager for routing incoming replies */
  sessionManager: SessionManager;
  /** Message history store */
  messageHistory: MessageHistory;
  /** Application configuration */
  config: Config;
  /**
   * Optional event dispatcher for testing.
   * When provided, startEventListener will use this dispatcher
   * instead of creating a new one internally.
   */
  eventDispatcher?: lark.EventDispatcher;
}

/**
 * Wraps the Feishu (Lark) SDK to provide message sending and
 * WebSocket event listening capabilities.
 *
 * Responsibilities:
 * - Send text messages to users via Feishu private chat
 * - Listen for incoming messages via WebSocket long connection
 * - Record all messages (incoming and outgoing) to MessageHistory
 * - Route incoming replies to SessionManager for pending question resolution
 */
export class FeishuClient {
  private readonly larkClient: lark.Client;
  private readonly sessionManager: SessionManager;
  private readonly messageHistory: MessageHistory;
  private readonly config: Config;
  private readonly eventDispatcher: lark.EventDispatcher | undefined;
  private wsClient: lark.WSClient | undefined;

  constructor(options: FeishuClientOptions) {
    this.larkClient = options.larkClient;
    this.sessionManager = options.sessionManager;
    this.messageHistory = options.messageHistory;
    this.config = options.config;
    this.eventDispatcher = options.eventDispatcher;
  }

  /**
   * Send a text message to a user via Feishu private chat.
   *
   * The content parameter is plain text; it is automatically wrapped in
   * the JSON envelope required by the Feishu API (`{"text": "..."}`)
   * before sending.
   *
   * After successful delivery the message is recorded in MessageHistory.
   *
   * @param userId - Feishu Open ID of the target user
   * @param content - Plain text message content
   * @returns Object containing the Feishu message ID
   * @throws When the Feishu API call fails
   */
  async sendMessage(userId: string, content: string): Promise<{ messageId: string }> {
    const response = await this.larkClient.im.message.create({
      params: {
        receive_id_type: 'open_id',
      },
      data: {
        receive_id: userId,
        msg_type: 'text',
        content: JSON.stringify({ text: content }),
      },
    });

    const messageId = response?.data?.message_id;
    if (!messageId) {
      throw new Error(
        `Feishu API error: unexpected response — no message_id returned (code: ${response?.code}, msg: ${response?.msg})`,
      );
    }

    this.messageHistory.add({
      direction: 'outgoing',
      content,
      feishuMessageId: messageId,
    });

    return { messageId };
  }

  /**
   * Send an interactive card message to a user via Feishu private chat.
   *
   * @param userId - Feishu Open ID of the target user
   * @param card - The card payload object (Feishu interactive card format)
   * @param contentForHistory - Plain text representation for message history recording
   * @returns Object containing the Feishu message ID
   * @throws When the Feishu API call fails
   */
  async sendCardMessage(
    userId: string,
    card: object,
    contentForHistory: string,
  ): Promise<{ messageId: string }> {
    const response = await this.larkClient.im.message.create({
      params: {
        receive_id_type: 'open_id',
      },
      data: {
        receive_id: userId,
        msg_type: 'interactive',
        content: JSON.stringify(card),
      },
    });

    const messageId = response?.data?.message_id;
    if (!messageId) {
      throw new Error(
        `Feishu API error: unexpected response — no message_id returned (code: ${response?.code}, msg: ${response?.msg})`,
      );
    }

    this.messageHistory.add({
      direction: 'outgoing',
      content: contentForHistory,
      feishuMessageId: messageId,
    });

    return { messageId };
  }

  /**
   * Handle an incoming im.message.receive_v1 event from the Feishu WebSocket.
   *
   * Parses the text content from the event payload, records it in
   * MessageHistory, and attempts to resolve a pending question in
   * SessionManager.
   *
   * Only text messages (message_type === 'text') are processed.
   * Non-text messages are silently ignored.
   *
   * @param event - The raw event payload from the Feishu SDK event dispatcher
   */
  handleMessageEvent(event: Record<string, unknown>): void {
    try {
      const message = event.message as Record<string, unknown> | undefined;
      if (!message) {
        return;
      }

      const messageType = message.message_type as string | undefined;
      if (messageType !== 'text') {
        return;
      }

      const rawContent = message.content as string | undefined;
      if (!rawContent) {
        return;
      }

      let textContent: string;
      try {
        const parsed = JSON.parse(rawContent) as { text?: string };
        textContent = parsed.text ?? '';
      } catch {
        // If content is not valid JSON, use raw string as fallback
        textContent = rawContent;
      }

      if (!textContent) {
        return;
      }

      const feishuMessageId = message.message_id as string | undefined;

      // Extract sender open_id from the event payload
      const sender = event.sender as Record<string, unknown> | undefined;
      const senderId = sender?.sender_id as Record<string, unknown> | undefined;
      const senderOpenId = senderId?.open_id as string | undefined;

      this.messageHistory.add({
        direction: 'incoming',
        content: textContent,
        ...(feishuMessageId ? { feishuMessageId } : {}),
        ...(senderOpenId ? { senderOpenId } : {}),
      });

      this.sessionManager.resolveReply(textContent);
    } catch (error: unknown) {
      // Log but do not rethrow — event handlers must not crash the WS connection.
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[FeishuClient] Error handling message event: ${errorMessage}`);
    }
  }

  /**
   * Start the WebSocket long connection to receive Feishu events.
   *
   * Registers an event handler for `im.message.receive_v1` and opens
   * a persistent WebSocket via the Feishu SDK WSClient.
   *
   * The SDK handles automatic reconnection on disconnect.
   */
  async startEventListener(): Promise<void> {
    const dispatcher =
      this.eventDispatcher ??
      new lark.EventDispatcher({}).register({
        'im.message.receive_v1': async (data: Record<string, unknown>) => {
          this.handleMessageEvent(data);
        },
      });

    this.wsClient = new lark.WSClient({
      appId: this.config.appId,
      appSecret: this.config.appSecret,
      loggerLevel: lark.LoggerLevel.info,
    });

    await this.wsClient.start({
      eventDispatcher: dispatcher,
    });
  }

  /**
   * Return the default target user Open ID from configuration, if set.
   */
  getDefaultUserId(): string | undefined {
    return this.config.targetUserId;
  }
}
