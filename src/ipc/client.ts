/**
 * IPC Client
 *
 * Used by MCP process to communicate with Agent process.
 * Connects to Agent's Unix Domain Socket to forward feishu_ask and feishu_notify requests.
 */

import net from 'node:net';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { IPC_SOCKET_PATH } from '../process-lock.js';
import type {
  AskRequest,
  AskResponse,
  NotifyRequest,
  NotifyResponse,
  IpcResponse,
} from './protocol.js';

export class IpcClient {
  /**
   * Check if IPC server (Agent) is available.
   * Simply checks if the socket file exists.
   */
  isAgentAvailable(): boolean {
    try {
      fs.accessSync(IPC_SOCKET_PATH, fs.constants.R_OK | fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Send ask request to Agent and wait for reply.
   *
   * @param payload - The ask request payload
   * @returns The ask response payload from Agent
   */
  async ask(payload: AskRequest['payload']): Promise<AskResponse['payload']> {
    const id = crypto.randomUUID();
    const request: AskRequest = {
      id,
      type: 'request',
      action: 'ask',
      payload,
    };

    const response = await this.sendRequest<AskResponse>(request);
    return response.payload;
  }

  /**
   * Send notify request to Agent.
   *
   * @param payload - The notify request payload
   * @returns The notify response payload from Agent
   */
  async notify(payload: NotifyRequest['payload']): Promise<NotifyResponse['payload']> {
    const id = crypto.randomUUID();
    const request: NotifyRequest = {
      id,
      type: 'request',
      action: 'notify',
      payload,
    };

    const response = await this.sendRequest<NotifyResponse>(request);
    return response.payload;
  }

  /**
   * Send a request and wait for response.
   */
  private sendRequest<T extends IpcResponse>(
    request: AskRequest | NotifyRequest,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(IPC_SOCKET_PATH);
      let buffer = '';
      let resolved = false;

      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
        }
      };

      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (!resolved) {
          cleanup();
          reject(new Error('IPC connection timeout'));
        }
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(connectionTimeout);
        socket.write(JSON.stringify(request) + '\n');
      });

      socket.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const response = JSON.parse(line) as T;
            if (response.id === request.id) {
              resolved = true;
              socket.end();
              resolve(response);
              return;
            }
          } catch {
            // Ignore parse errors, wait for valid response
          }
        }
      });

      socket.on('error', (err) => {
        if (!resolved) {
          cleanup();
          reject(new Error(`IPC error: ${err.message}`));
        }
      });

      socket.on('close', () => {
        if (!resolved) {
          resolved = true;
          reject(new Error('IPC connection closed unexpectedly'));
        }
      });
    });
  }
}
