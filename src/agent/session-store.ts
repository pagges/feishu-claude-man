/**
 * SessionStore - Manages user sessions with optional file persistence.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { StoredSession } from './types.js';

/**
 * SessionStore manages user sessions for the agent service.
 * Sessions can be optionally persisted to a JSON file.
 */
export class SessionStore {
  private sessions: Map<string, StoredSession> = new Map();
  private readonly persistPath?: string;

  /**
   * Create a new SessionStore.
   *
   * @param persistPath - Optional path for JSON file persistence
   */
  constructor(persistPath?: string) {
    this.persistPath = persistPath;
    if (persistPath) {
      this.loadFromDisk();
    }
  }

  /**
   * Get an existing session or create a new one for a user.
   *
   * @param userId - Feishu Open ID
   * @returns The user's session
   */
  getOrCreate(userId: string): StoredSession {
    let session = this.findByUser(userId);
    if (!session) {
      session = {
        id: crypto.randomUUID(),
        userId,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        status: 'idle',
      };
      this.sessions.set(session.id, session);
      this.saveToDisk();
    }
    return session;
  }

  /**
   * Get a session by ID.
   *
   * @param sessionId - Session ID
   * @returns The session or undefined
   */
  get(sessionId: string): StoredSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Find a session by user ID.
   *
   * @param userId - Feishu Open ID
   * @returns The session or undefined
   */
  findByUser(userId: string): StoredSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        return session;
      }
    }
    return undefined;
  }

  /**
   * Update a session with partial data.
   *
   * @param sessionId - Session ID
   * @param updates - Partial session data to merge
   */
  update(sessionId: string, updates: Partial<Omit<StoredSession, 'id' | 'userId' | 'createdAt'>>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates, { lastActiveAt: Date.now() });
      this.saveToDisk();
    }
  }

  /**
   * Delete a session.
   *
   * @param sessionId - Session ID
   */
  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.saveToDisk();
  }

  /**
   * Clear a user's session context (for /new command).
   *
   * @param userId - Feishu Open ID
   */
  clearUserSession(userId: string): void {
    const session = this.findByUser(userId);
    if (session) {
      this.update(session.id, {
        claudeSessionId: undefined,
        status: 'idle',
      });
    }
  }

  /**
   * Clean up sessions that have been inactive for too long.
   *
   * @param maxAgeMs - Maximum age in milliseconds (default: 24 hours)
   * @returns Number of sessions cleaned up
   */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of this.sessions) {
      if (now - session.lastActiveAt > maxAgeMs) {
        this.sessions.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.saveToDisk();
    }

    return cleaned;
  }

  /**
   * Get all sessions.
   *
   * @returns Array of all sessions
   */
  getAll(): StoredSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get the number of sessions.
   */
  get size(): number {
    return this.sessions.size;
  }

  /**
   * Load sessions from disk.
   */
  private loadFromDisk(): void {
    if (!this.persistPath || !existsSync(this.persistPath)) {
      return;
    }

    try {
      const data = readFileSync(this.persistPath, 'utf-8');
      const parsed = JSON.parse(data) as StoredSession[];

      for (const session of parsed) {
        // Reset running sessions to idle on reload
        if (session.status === 'running') {
          session.status = 'idle';
        }
        this.sessions.set(session.id, session);
      }
    } catch (error) {
      console.error(`[SessionStore] Failed to load sessions from ${this.persistPath}:`, error);
    }
  }

  /**
   * Save sessions to disk.
   */
  private saveToDisk(): void {
    if (!this.persistPath) {
      return;
    }

    try {
      // Ensure directory exists
      const dir = dirname(this.persistPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const data = JSON.stringify(Array.from(this.sessions.values()), null, 2);
      writeFileSync(this.persistPath, data, 'utf-8');
    } catch (error) {
      console.error(`[SessionStore] Failed to save sessions to ${this.persistPath}:`, error);
    }
  }
}
