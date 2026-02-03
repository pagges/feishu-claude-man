/**
 * AgentExecutor - Uses local Claude CLI to execute user requests.
 *
 * This implementation uses the locally installed `claude` command-line tool
 * instead of the Claude Agent SDK, allowing users to leverage their
 * Claude Code subscription.
 */

import { spawn, type ChildProcess } from 'child_process';
import type { AgentConfig, AgentResult } from './types.js';

/**
 * Message types emitted during agent execution.
 */
export type AgentMessage =
  | { type: 'init'; sessionId: string }
  | { type: 'text'; content: string }
  | { type: 'tool_use'; tool: string; input: unknown }
  | { type: 'tool_result'; tool: string; output: unknown }
  | { type: 'result'; content: string }
  | { type: 'error'; error: string };

/**
 * Callback for streaming agent messages.
 */
export type OnMessageCallback = (message: AgentMessage) => void | Promise<void>;

/**
 * Options for executing a single request.
 */
export interface ExecuteOptions {
  /** Optional session ID for context resumption */
  sessionId?: string;
  /** Optional callback for streaming messages */
  onMessage?: OnMessageCallback;
  /** Optional abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * AgentExecutor uses local Claude CLI to provide a simple interface
 * for executing user requests with Claude.
 */
export class AgentExecutor {
  private readonly config: AgentConfig;
  private currentProcess: ChildProcess | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * Execute a user request using local Claude CLI.
   *
   * @param prompt - The user's request
   * @param options - Execution options
   * @returns The execution result with optional session ID for resumption
   */
  async execute(prompt: string, options: ExecuteOptions = {}): Promise<AgentResult> {
    const { sessionId, onMessage, signal } = options;

    // Build CLI arguments
    const args: string[] = [
      '--print', // Non-interactive mode
      '--output-format', 'stream-json', // Stream JSON output for real-time updates
      '--verbose', // Include detailed output
      '--strict-mcp-config', // Ignore all MCP configurations (prevent conflicts)
    ];

    // Add model if configured
    if (this.config.model) {
      args.push('--model', this.config.model);
    }

    // Add permission mode
    if (this.config.permissionMode) {
      args.push('--permission-mode', this.config.permissionMode);
    }

    // Add allowed tools if configured (comma-separated)
    if (this.config.allowedTools && this.config.allowedTools.length > 0) {
      args.push('--allowedTools', this.config.allowedTools.join(','));
    }

    // Resume session if session ID provided
    if (sessionId) {
      args.push('--resume', sessionId);
    }

    // Add -- separator before prompt to prevent it from being parsed as an option argument
    args.push('--', prompt);

    return new Promise((resolve, reject) => {
      let result: string | undefined;
      let newSessionId: string | undefined;
      let buffer = '';
      let errorOutput = '';

      const claudePath = this.config.claudePath;
      console.log('[AgentExecutor] Starting claude with path:', claudePath, 'args:', args);

      // Spawn the claude process
      // Use 'ignore' for stdin to prevent claude from waiting for input
      this.currentProcess = spawn(claudePath, args, {
        cwd: this.config.workingDirectory,
        env: {
          ...process.env,
          // Ensure we don't interfere with the parent process
          FORCE_COLOR: '0',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const proc = this.currentProcess;

      // Handle abort signal
      if (signal) {
        signal.addEventListener('abort', () => {
          if (proc && !proc.killed) {
            proc.kill('SIGTERM');
          }
        });
      }

      // Process stdout (JSON stream)
      proc.stdout?.on('data', async (data: Buffer) => {
        const chunk = data.toString();
        console.log('[AgentExecutor] stdout chunk:', chunk.substring(0, 200));
        buffer += chunk;

        // Process complete JSON lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const message = JSON.parse(line);
            await this.processMessage(message, onMessage, (sid) => {
              newSessionId = sid;
            }, (res) => {
              result = res;
            });
          } catch {
            // Not valid JSON, might be plain text output
            if (onMessage && line.trim()) {
              await onMessage({ type: 'text', content: line });
            }
          }
        }
      });

      // Collect stderr for error reporting
      proc.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        console.log('[AgentExecutor] stderr chunk:', chunk.substring(0, 500));
        errorOutput += chunk;
      });

      // Handle process completion
      proc.on('close', (code) => {
        this.currentProcess = null;

        // Process any remaining buffer
        if (buffer.trim()) {
          try {
            const message = JSON.parse(buffer);
            this.processMessage(message, onMessage, (sid) => {
              newSessionId = sid;
            }, (res) => {
              result = res;
            }).then(() => {
              finalize();
            }).catch(reject);
            return;
          } catch {
            // Not valid JSON
            if (onMessage && buffer.trim()) {
              onMessage({ type: 'text', content: buffer });
            }
          }
        }

        finalize();

        function finalize() {
          if (signal?.aborted) {
            reject(new Error('Task cancelled'));
            return;
          }

          if (code !== 0 && code !== null) {
            const error = errorOutput.trim() || `Claude CLI exited with code ${code}`;
            if (onMessage) {
              onMessage({ type: 'error', error });
            }
            reject(new Error(error));
            return;
          }

          resolve({
            result,
            sessionId: newSessionId,
          });
        }
      });

      // Handle process errors
      proc.on('error', (error) => {
        console.log('[AgentExecutor] Process error:', error);
        this.currentProcess = null;
        if (onMessage) {
          onMessage({ type: 'error', error: error.message });
        }
        reject(error);
      });

      // Log spawn success
      console.log('[AgentExecutor] Claude process spawned, PID:', proc.pid);
    });
  }

  /**
   * Process a single message from the CLI output stream.
   */
  private async processMessage(
    message: unknown,
    onMessage: OnMessageCallback | undefined,
    setSessionId: (id: string) => void,
    setResult: (result: string) => void,
  ): Promise<void> {
    if (typeof message !== 'object' || message === null) {
      return;
    }

    const msg = message as Record<string, unknown>;

    // Extract session ID from init message
    if (msg.type === 'system' && msg.subtype === 'init' && typeof msg.session_id === 'string') {
      setSessionId(msg.session_id);
      if (onMessage) {
        await onMessage({ type: 'init', sessionId: msg.session_id });
      }
      return;
    }

    // Extract result from result message
    if ('result' in msg && typeof msg.result === 'string') {
      setResult(msg.result);
      if (onMessage) {
        await onMessage({ type: 'result', content: msg.result });
      }
      return;
    }

    // Handle text/assistant messages
    if (msg.type === 'assistant' && typeof msg.content === 'string') {
      if (onMessage) {
        await onMessage({ type: 'text', content: msg.content });
      }
      return;
    }

    // Handle tool use messages
    if (msg.type === 'tool_use' && typeof msg.tool_name === 'string') {
      if (onMessage) {
        await onMessage({
          type: 'tool_use',
          tool: msg.tool_name,
          input: msg.tool_input,
        });
      }
      return;
    }

    // Handle tool result messages
    if (msg.type === 'tool_result' && 'tool_result' in msg) {
      if (onMessage) {
        await onMessage({
          type: 'tool_result',
          tool: (msg.tool_name as string) || 'unknown',
          output: msg.tool_result,
        });
      }
      return;
    }
  }

  /**
   * Cancel the currently running execution.
   */
  cancel(): void {
    if (this.currentProcess && !this.currentProcess.killed) {
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = null;
    }
  }
}
