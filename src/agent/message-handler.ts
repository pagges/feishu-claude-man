/**
 * MessageHandler - Processes incoming Feishu messages and routes to agent.
 */

import type { AgentExecutor, AgentMessage } from './agent-executor.js';
import type { SessionStore } from './session-store.js';
import type { ParsedMessageEvent, AgentConfig } from './types.js';
import type { CardOptions, MessageSemantic } from '../smart-card-builder.js';

/**
 * Track active abort controllers for cancellation.
 */
const activeAbortControllers = new Map<string, AbortController>();

/**
 * Interface for sending messages back to Feishu.
 */
export interface MessageSender {
  sendMessage(
    userId: string,
    content: string,
    cardOptions?: CardOptions,
  ): Promise<{ messageId: string }>;
}

/**
 * Progress tracker for streaming updates.
 */
class ProgressTracker {
  private toolsUsed: string[] = [];
  private lastUpdateTime = 0;
  private readonly updateIntervalMs: number;
  private readonly sender: MessageSender;
  private readonly userId: string;
  private updateCount = 0;
  private readonly maxUpdates: number;

  constructor(
    sender: MessageSender,
    userId: string,
    updateIntervalMs = 30000, // 30 seconds
    maxUpdates = 5,
  ) {
    this.sender = sender;
    this.userId = userId;
    this.updateIntervalMs = updateIntervalMs;
    this.maxUpdates = maxUpdates;
  }

  /**
   * Track a tool use event.
   */
  async trackToolUse(tool: string): Promise<void> {
    this.toolsUsed.push(tool);

    // Send periodic progress updates
    const now = Date.now();
    if (
      now - this.lastUpdateTime >= this.updateIntervalMs &&
      this.updateCount < this.maxUpdates
    ) {
      await this.sendProgressUpdate();
      this.lastUpdateTime = now;
      this.updateCount++;
    }
  }

  /**
   * Send a progress update message.
   */
  private async sendProgressUpdate(): Promise<void> {
    const recentTools = this.toolsUsed.slice(-5);
    const toolsSummary = recentTools.length > 0
      ? recentTools.join(' → ')
      : '分析中';

    try {
      await this.sender.sendMessage(
        this.userId,
        `🔄 仍在处理中...\n\n**最近操作**: ${toolsSummary}`,
        { semantic: 'progress' as const, compact: true },
      );
    } catch {
      // Ignore send errors for progress updates
    }
  }

  /**
   * Get summary of tools used.
   */
  getSummary(): string {
    if (this.toolsUsed.length === 0) return '';

    const uniqueTools = [...new Set(this.toolsUsed)];
    return `使用了 ${uniqueTools.length} 种工具，共 ${this.toolsUsed.length} 次操作`;
  }
}

/**
 * MessageHandler processes incoming Feishu messages and coordinates
 * between the session store and agent executor.
 */
export class MessageHandler {
  private readonly sender: MessageSender;
  private readonly sessionStore: SessionStore;
  private readonly agentExecutor: AgentExecutor;
  private readonly config: AgentConfig;
  private readonly enableProgressUpdates: boolean;

  constructor(
    sender: MessageSender,
    sessionStore: SessionStore,
    agentExecutor: AgentExecutor,
    config: AgentConfig,
    options?: { enableProgressUpdates?: boolean },
  ) {
    this.sender = sender;
    this.sessionStore = sessionStore;
    this.agentExecutor = agentExecutor;
    this.config = config;
    this.enableProgressUpdates = options?.enableProgressUpdates ?? true;
  }

  /**
   * Handle an incoming message event.
   *
   * @param event - Parsed message event
   */
  async handle(event: ParsedMessageEvent): Promise<void> {
    const { senderId, content, messageType } = event;
    console.log(`[DEBUG MessageHandler] Handling event from ${senderId}, type=${messageType}, content="${content}"`);

    // Check user whitelist
    if (!this.isUserAllowed(senderId)) {
      console.log(`[DEBUG MessageHandler] User ${senderId} not allowed`);
      await this.sender.sendMessage(
        senderId,
        '抱歉，您没有使用此服务的权限',
        { semantic: 'error', compact: true },
      );
      return;
    }

    // Handle non-text messages with helpful response
    if (messageType !== 'text') {
      const unsupportedMessages: Record<string, string> = {
        image: '📷 暂不支持图片消息\n\n请用文字描述图片内容或你想做的事情',
        file: '📁 暂不支持文件消息\n\n请用文字描述文件内容或你想做的事情',
        audio: '🎤 暂不支持语音消息\n\n请发送文字',
        sticker: '',  // Ignore stickers silently
      };
      const response = unsupportedMessages[messageType] ?? `暂不支持 ${messageType} 类型消息，请发送文字`;
      if (response) {
        await this.sender.sendMessage(senderId, response, { semantic: 'warning', compact: true });
      }
      return;
    }

    // Trim and validate content
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return; // Ignore empty messages
    }

    // Check for slash commands
    if (trimmedContent.startsWith('/')) {
      await this.handleCommand(senderId, trimmedContent);
      return;
    }

    // Handle normal message
    await this.handleUserMessage(senderId, trimmedContent);
  }

  /**
   * Handle a slash command.
   */
  private async handleCommand(userId: string, command: string): Promise<void> {
    const [cmd, ...args] = command.trim().split(/\s+/);
    const lowerCmd = cmd.toLowerCase();

    switch (lowerCmd) {
      case '/new':
        await this.handleNewCommand(userId);
        break;

      case '/cancel':
        await this.handleCancelCommand(userId);
        break;

      case '/status':
        await this.handleStatusCommand(userId);
        break;

      case '/help':
        await this.handleHelpCommand(userId);
        break;

      case '/resume':
        await this.handleResumeCommand(userId, args[0]);
        break;

      default:
        await this.sender.sendMessage(userId, `未知命令: ${cmd}\n\n发送 /help 查看可用命令。`);
    }
  }

  /**
   * Handle /new command - clear session context.
   */
  private async handleNewCommand(userId: string): Promise<void> {
    this.sessionStore.clearUserSession(userId);
    await this.sender.sendMessage(userId, '✅ 已开始新会话', { semantic: 'success', compact: true });
  }

  /**
   * Handle /cancel command - cancel running task.
   */
  private async handleCancelCommand(userId: string): Promise<void> {
    const session = this.sessionStore.findByUser(userId);
    if (!session) {
      await this.sender.sendMessage(userId, '没有活动的会话。');
      return;
    }

    if (session.status !== 'running') {
      await this.sender.sendMessage(userId, '当前没有正在执行的任务。');
      return;
    }

    // Abort the running task
    const abortController = activeAbortControllers.get(session.id);
    if (abortController) {
      abortController.abort();
      activeAbortControllers.delete(session.id);
    }

    this.sessionStore.update(session.id, { status: 'cancelled' });
    await this.sender.sendMessage(userId, '⚠️ 任务已取消', { semantic: 'warning', compact: true });
  }

  /**
   * Handle /status command - show current status.
   */
  private async handleStatusCommand(userId: string): Promise<void> {
    const session = this.sessionStore.findByUser(userId);
    if (!session) {
      await this.sender.sendMessage(
        userId,
        '没有活动的会话。发送任意消息开始对话。',
        { semantic: 'info', compact: true },
      );
      return;
    }

    const statusEmoji = session.status === 'running' ? '🔄' : '💤';
    const statusText = session.status === 'running' ? '执行中' : '空闲';
    const hasContext = session.claudeSessionId ? '✓ 已保存' : '✗ 无';
    const lastActive = new Date(session.lastActiveAt).toLocaleString('zh-CN');

    const message = `| 项目 | 状态 |
|------|------|
| 当前状态 | ${statusEmoji} ${statusText} |
| 上下文 | ${hasContext} |
| 最后活动 | ${lastActive} |
| 会话 ID | \`${session.id.substring(0, 8)}...\` |`;

    await this.sender.sendMessage(userId, message, {
      semantic: 'info',
      title: '📊 会话状态',
    });
  }

  /**
   * Handle /help command - show help message.
   */
  private async handleHelpCommand(userId: string): Promise<void> {
    const message = `**可用命令**

| 命令 | 说明 |
|------|------|
| \`/new\` | 清除上下文，开始新对话 |
| \`/cancel\` | 取消正在执行的任务 |
| \`/status\` | 查看当前会话状态 |
| \`/help\` | 显示此帮助信息 |

**Claude 能力**
- 📖 读取和编辑代码文件
- 💻 执行终端命令
- 🔍 搜索代码库
- 🌐 访问网页信息

**提示**
- 直接发送消息即可对话
- 长时间任务请耐心等待
- 如遇问题可发送 \`/new\` 重置`;

    await this.sender.sendMessage(userId, message, {
      semantic: 'help',
      title: '🤖 Claude Agent 帮助',
    });
  }

  /**
   * Handle /resume command - resume a specific session.
   */
  private async handleResumeCommand(userId: string, sessionId?: string): Promise<void> {
    if (!sessionId) {
      await this.sender.sendMessage(userId, '请提供会话 ID: /resume <session_id>');
      return;
    }

    const session = this.sessionStore.findByUser(userId);
    if (!session) {
      await this.sender.sendMessage(userId, '没有可恢复的会话。');
      return;
    }

    await this.sender.sendMessage(userId, `会话已就绪，可以继续对话。`);
  }

  /**
   * Handle a regular user message - execute with agent.
   */
  private async handleUserMessage(userId: string, content: string): Promise<void> {
    const session = this.sessionStore.getOrCreate(userId);

    // Check if already running
    if (session.status === 'running') {
      await this.sender.sendMessage(
        userId,
        '⏳ 当前有任务正在执行，请等待完成或发送 `/cancel` 取消',
        { semantic: 'warning', compact: true },
      );
      return;
    }

    // Mark session as running
    this.sessionStore.update(session.id, { status: 'running' });

    // Create abort controller for cancellation
    const abortController = new AbortController();
    activeAbortControllers.set(session.id, abortController);

    // Send processing indicator (stage 2: actually starting Claude)
    await this.sender.sendMessage(userId, '⏳ 正在调用 Claude...', { semantic: 'progress', compact: true });

    // Create progress tracker
    const progressTracker = this.enableProgressUpdates
      ? new ProgressTracker(this.sender, userId)
      : null;

    const startTime = Date.now();

    try {
      // Execute with agent
      const result = await this.agentExecutor.execute(content, {
        sessionId: session.claudeSessionId,
        signal: abortController.signal,
        onMessage: async (msg: AgentMessage) => {
          // Track tool usage for progress updates
          if (msg.type === 'tool_use' && progressTracker) {
            await progressTracker.trackToolUse(msg.tool);
          }
        },
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      // Cleanup abort controller
      activeAbortControllers.delete(session.id);

      // Update session with new Claude session ID
      this.sessionStore.update(session.id, {
        claudeSessionId: result.sessionId,
        status: 'idle',
      });

      // Send result
      if (result.result) {
        const summary = progressTracker?.getSummary();
        await this.sendFormattedResult(userId, result.result, duration, summary);
      } else {
        await this.sender.sendMessage(
          userId,
          `✅ 任务完成（无文本输出）`,
          { semantic: 'success', footer: `耗时: ${duration}s` },
        );
      }
    } catch (error) {
      // Cleanup abort controller
      activeAbortControllers.delete(session.id);

      // Reset session status
      this.sessionStore.update(session.id, { status: 'idle' });

      // Send error message
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('cancelled') || errorMessage.includes('aborted')) {
        await this.sender.sendMessage(userId, '⚠️ 任务已取消', { semantic: 'warning', compact: true });
      } else {
        await this.sendErrorMessage(userId, errorMessage);
      }
    }
  }

  /**
   * Send a formatted result, truncating if necessary.
   */
  private async sendFormattedResult(
    userId: string,
    result: string,
    duration?: string,
    summary?: string,
  ): Promise<void> {
    const MAX_LENGTH = 3000;

    let message = result;
    let truncated = false;
    if (message.length > MAX_LENGTH) {
      message = message.substring(0, MAX_LENGTH) + '\n\n... (结果已截断)';
      truncated = true;
    }

    // Build footer with stats
    const footerParts: string[] = [];
    if (duration) footerParts.push(`耗时: ${duration}s`);
    if (summary) footerParts.push(summary);
    if (truncated) footerParts.push('内容已截断');

    await this.sender.sendMessage(userId, message, {
      footer: footerParts.length > 0 ? footerParts.join(' | ') : undefined,
    });
  }

  /**
   * Send a formatted error message.
   */
  private async sendErrorMessage(userId: string, errorMessage: string): Promise<void> {
    // Truncate very long error messages
    const maxErrorLength = 500;
    let displayError = errorMessage;
    if (displayError.length > maxErrorLength) {
      displayError = displayError.substring(0, maxErrorLength) + '...';
    }

    // Provide helpful suggestions based on error type
    let suggestion = '';
    if (errorMessage.includes('rate limit')) {
      suggestion = '稍后重试';
    } else if (errorMessage.includes('timeout')) {
      suggestion = '任务可能过于复杂，请尝试简化请求';
    } else if (errorMessage.includes('permission')) {
      suggestion = '检查工作目录权限设置';
    }

    let message = displayError;
    if (suggestion) {
      message += `\n\n💡 **建议**：${suggestion}`;
    }

    await this.sender.sendMessage(userId, message, {
      semantic: 'error',
      title: '❌ 执行出错',
    });
  }

  /**
   * Check if a user is allowed to use the service.
   */
  private isUserAllowed(userId: string): boolean {
    // If no whitelist configured, allow all users
    if (!this.config.allowedUsers || this.config.allowedUsers.length === 0) {
      return true;
    }

    return this.config.allowedUsers.includes(userId);
  }
}
