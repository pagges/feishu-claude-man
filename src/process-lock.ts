/**
 * Process lock and PID file management.
 *
 * Prevents multiple WebSocket connections to the same Feishu app
 * and cleans up stale processes from previous runs.
 *
 * Lock files:
 *   /tmp/feishu-claude-ws.lock   — WebSocket exclusive lock (only one holder)
 *
 * Socket files:
 *   /tmp/feishu-claude-ipc.sock  — IPC Unix socket for MCP-Agent communication
 *
 * PID files:
 *   /tmp/feishu-claude-mcp.pid   — MCP bridge process
 *   /tmp/feishu-claude-agent.pid — Agent service process
 */

import fs from 'node:fs';
import path from 'node:path';

const LOCK_DIR = '/tmp';

export const WS_LOCK_FILE = path.join(LOCK_DIR, 'feishu-claude-ws.lock');
export const IPC_SOCKET_PATH = path.join(LOCK_DIR, 'feishu-claude-ipc.sock');
export const MCP_PID_FILE = path.join(LOCK_DIR, 'feishu-claude-mcp.pid');
export const AGENT_PID_FILE = path.join(LOCK_DIR, 'feishu-claude-agent.pid');

export type ServiceType = 'mcp' | 'agent';

interface WsLockInfo {
  pid: number;
  service: ServiceType;
  startedAt: number;
}

/**
 * Check if a process is still alive by sending signal 0.
 */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and parse the WebSocket lock file.
 * Returns null if the file doesn't exist or is malformed.
 */
function readWsLock(): WsLockInfo | null {
  try {
    const content = fs.readFileSync(WS_LOCK_FILE, 'utf-8');
    return JSON.parse(content) as WsLockInfo;
  } catch {
    return null;
  }
}

/**
 * Try to acquire the WebSocket lock.
 *
 * Rules:
 * - If no lock or stale lock (dead process): acquire
 * - If lock held by live agent and caller is mcp: yield (return false)
 * - If lock held by live mcp and caller is mcp (different PID): yield
 * - If caller is agent: always force-acquire (agent has priority)
 */
export function acquireWsLock(service: ServiceType): boolean {
  const existing = readWsLock();

  if (existing && isProcessAlive(existing.pid) && existing.pid !== process.pid) {
    if (service === 'mcp') {
      // MCP bridge never competes — yield to any live holder
      console.error(
        `[process-lock] WS lock held by ${existing.service} (PID ${existing.pid}), MCP bridge will skip WebSocket`,
      );
      return false;
    }
    // Agent always takes priority
    console.error(
      `[process-lock] Force-acquiring WS lock from ${existing.service} (PID ${existing.pid})`,
    );
  }

  const lockInfo: WsLockInfo = {
    pid: process.pid,
    service,
    startedAt: Date.now(),
  };

  fs.writeFileSync(WS_LOCK_FILE, JSON.stringify(lockInfo));
  console.error(`[process-lock] WS lock acquired by ${service} (PID ${process.pid})`);
  return true;
}

/**
 * Release the WebSocket lock if we hold it.
 */
export function releaseWsLock(): void {
  try {
    const existing = readWsLock();
    if (existing && existing.pid === process.pid) {
      fs.unlinkSync(WS_LOCK_FILE);
      console.error('[process-lock] WS lock released');
    }
  } catch {
    // Ignore — file may already be gone
  }
}

/**
 * Kill a stale process recorded in a PID file from a previous run.
 *
 * Sends SIGTERM, waits briefly, then SIGKILL if still alive.
 * Removes the PID file afterwards.
 */
export async function cleanupStaleProcess(pidFile: string): Promise<void> {
  let oldPid: number;
  try {
    const content = fs.readFileSync(pidFile, 'utf-8');
    oldPid = parseInt(content.trim(), 10);
  } catch {
    // PID file doesn't exist — nothing to clean
    return;
  }

  if (isNaN(oldPid) || oldPid === process.pid) {
    return;
  }

  if (!isProcessAlive(oldPid)) {
    // Process already dead — just remove stale PID file
    try {
      fs.unlinkSync(pidFile);
    } catch {
      // Ignore
    }
    return;
  }

  console.error(`[process-lock] Killing stale process PID ${oldPid}...`);
  try {
    process.kill(oldPid, 'SIGTERM');
  } catch {
    // Already gone
    return;
  }

  // Wait up to 3 seconds for graceful exit
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (!isProcessAlive(oldPid)) {
      console.error(`[process-lock] Stale process PID ${oldPid} exited`);
      break;
    }
  }

  // Force kill if still alive
  if (isProcessAlive(oldPid)) {
    console.error(`[process-lock] Force-killing PID ${oldPid}`);
    try {
      process.kill(oldPid, 'SIGKILL');
    } catch {
      // Ignore
    }
  }

  // Also release WS lock if it was held by the killed process
  try {
    const lock = readWsLock();
    if (lock && lock.pid === oldPid) {
      fs.unlinkSync(WS_LOCK_FILE);
      console.error(`[process-lock] Removed stale WS lock from PID ${oldPid}`);
    }
  } catch {
    // Ignore
  }

  try {
    fs.unlinkSync(pidFile);
  } catch {
    // Ignore
  }
}

/**
 * Write the current process PID to a file.
 */
export function writePidFile(pidFile: string): void {
  fs.writeFileSync(pidFile, String(process.pid));
  console.error(`[process-lock] PID file written: ${pidFile} (PID ${process.pid})`);
}

/**
 * Remove PID file (only if it belongs to the current process).
 */
export function removePidFile(pidFile: string): void {
  try {
    const content = fs.readFileSync(pidFile, 'utf-8');
    const pid = parseInt(content.trim(), 10);
    if (pid === process.pid) {
      fs.unlinkSync(pidFile);
    }
  } catch {
    // Ignore
  }
}

/**
 * Register process exit handlers for cleanup.
 * Releases WS lock and removes PID file on exit.
 */
export function registerExitCleanup(pidFile: string, holdsWsLock: boolean): void {
  const cleanup = () => {
    if (holdsWsLock) {
      releaseWsLock();
    }
    removePidFile(pidFile);
  };

  process.on('exit', cleanup);
}
