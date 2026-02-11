/**
 * IPC Server
 *
 * Runs in the Agent process and handles requests from MCP processes.
 * Uses Unix Domain Socket for inter-process communication.
 */

import net from 'node:net';
import fs from 'node:fs';
import { IPC_SOCKET_PATH } from '../process-lock.js';
import type {
  IpcMessage,
  AskRequest,
  AskResponse,
  NotifyRequest,
  NotifyResponse,
  ErrorResponse,
  IpcRequest,
} from './protocol.js';
import { isAskRequest, isNotifyRequest } from './protocol.js';

export type AskHandler = (
  payload: AskRequest['payload'],
) => Promise<AskResponse['payload']>;

export type NotifyHandler = (
  payload: NotifyRequest['payload'],
) => Promise<NotifyResponse['payload']>;

export class IpcServer {
  private server: net.Server | null = null;
  private askHandler: AskHandler | null = null;
  private notifyHandler: NotifyHandler | null = null;

  /**
   * Register handler for ask requests from MCP.
   */
  onAsk(handler: AskHandler): void {
    this.askHandler = handler;
  }

  /**
   * Register handler for notify requests from MCP.
   */
  onNotify(handler: NotifyHandler): void {
    this.notifyHandler = handler;
  }

  /**
   * Start the IPC server.
   */
  async start(): Promise<void> {
    // Remove stale socket file
    try {
      fs.unlinkSync(IPC_SOCKET_PATH);
    } catch {
      // Ignore - file may not exist
    }

    this.server = net.createServer((socket) => {
      this.handleConnection(socket);
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.listen(IPC_SOCKET_PATH, () => {
        console.error(`[IpcServer] Listening on ${IPC_SOCKET_PATH}`);
        resolve();
      });
      this.server!.on('error', reject);
    });
  }

  /**
   * Stop the IPC server and cleanup.
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    try {
      fs.unlinkSync(IPC_SOCKET_PATH);
    } catch {
      // Ignore
    }
    console.error('[IpcServer] Stopped');
  }

  /**
   * Handle a new client connection.
   */
  private handleConnection(socket: net.Socket): void {
    let buffer = '';

    socket.on('data', async (data) => {
      buffer += data.toString();

      // Process complete JSON messages (newline-delimited)
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const msg = JSON.parse(line) as IpcRequest;
          const response = await this.handleMessage(msg);
          socket.write(JSON.stringify(response) + '\n');
        } catch (e) {
          const errorResponse: ErrorResponse = {
            id: 'unknown',
            type: 'response',
            action: 'error',
            payload: { error: e instanceof Error ? e.message : String(e) },
          };
          socket.write(JSON.stringify(errorResponse) + '\n');
        }
      }
    });

    socket.on('error', (err) => {
      console.error('[IpcServer] Socket error:', err.message);
    });
  }

  /**
   * Route message to appropriate handler.
   */
  private async handleMessage(msg: IpcMessage): Promise<AskResponse | NotifyResponse | ErrorResponse> {
    if (isAskRequest(msg)) {
      if (!this.askHandler) {
        return {
          id: msg.id,
          type: 'response',
          action: 'ask',
          payload: {
            mcpRequestId: msg.payload.mcpRequestId,
            success: false,
            error: 'Ask handler not registered',
          },
        };
      }

      try {
        const result = await this.askHandler(msg.payload);
        return {
          id: msg.id,
          type: 'response',
          action: 'ask',
          payload: result,
        };
      } catch (e) {
        return {
          id: msg.id,
          type: 'response',
          action: 'ask',
          payload: {
            mcpRequestId: msg.payload.mcpRequestId,
            success: false,
            error: e instanceof Error ? e.message : String(e),
          },
        };
      }
    }

    if (isNotifyRequest(msg)) {
      if (!this.notifyHandler) {
        return {
          id: msg.id,
          type: 'response',
          action: 'notify',
          payload: {
            success: false,
            error: 'Notify handler not registered',
          },
        };
      }

      try {
        const result = await this.notifyHandler(msg.payload);
        return {
          id: msg.id,
          type: 'response',
          action: 'notify',
          payload: result,
        };
      } catch (e) {
        return {
          id: msg.id,
          type: 'response',
          action: 'notify',
          payload: {
            success: false,
            error: e instanceof Error ? e.message : String(e),
          },
        };
      }
    }

    return {
      id: msg.id,
      type: 'response',
      action: 'error',
      payload: { error: `Unknown action: ${msg.action}` },
    };
  }
}
