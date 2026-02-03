import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionStore } from './session-store.js';
import { existsSync, unlinkSync, mkdirSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';

describe('SessionStore', () => {
  const testDir = './test-data';
  const testPath = join(testDir, 'test-sessions.json');

  beforeEach(() => {
    // Clean up test file if exists
    if (existsSync(testPath)) {
      unlinkSync(testPath);
    }
  });

  afterEach(() => {
    // Clean up test file
    if (existsSync(testPath)) {
      unlinkSync(testPath);
    }
    // Clean up test directory
    if (existsSync(testDir)) {
      try {
        rmdirSync(testDir);
      } catch {
        // Ignore if directory is not empty
      }
    }
  });

  describe('in-memory mode', () => {
    it('should create a new session for a user', () => {
      const store = new SessionStore();
      const session = store.getOrCreate('user1');

      expect(session).toBeDefined();
      expect(session.userId).toBe('user1');
      expect(session.status).toBe('idle');
      expect(session.id).toBeDefined();
    });

    it('should return existing session for same user', () => {
      const store = new SessionStore();
      const session1 = store.getOrCreate('user1');
      const session2 = store.getOrCreate('user1');

      expect(session1.id).toBe(session2.id);
    });

    it('should create different sessions for different users', () => {
      const store = new SessionStore();
      const session1 = store.getOrCreate('user1');
      const session2 = store.getOrCreate('user2');

      expect(session1.id).not.toBe(session2.id);
    });

    it('should update session status', () => {
      const store = new SessionStore();
      const session = store.getOrCreate('user1');

      store.update(session.id, { status: 'running' });

      const updated = store.get(session.id);
      expect(updated?.status).toBe('running');
    });

    it('should update lastActiveAt on update', () => {
      const store = new SessionStore();
      const session = store.getOrCreate('user1');
      const originalLastActive = session.lastActiveAt;

      // Wait a bit to ensure time difference
      const delay = new Promise((resolve) => setTimeout(resolve, 10));
      return delay.then(() => {
        store.update(session.id, { status: 'running' });
        const updated = store.get(session.id);
        expect(updated!.lastActiveAt).toBeGreaterThan(originalLastActive);
      });
    });

    it('should clear user session', () => {
      const store = new SessionStore();
      const session = store.getOrCreate('user1');
      store.update(session.id, {
        claudeSessionId: 'claude-123',
        status: 'running',
      });

      store.clearUserSession('user1');

      const cleared = store.get(session.id);
      expect(cleared?.claudeSessionId).toBeUndefined();
      expect(cleared?.status).toBe('idle');
    });

    it('should find session by user', () => {
      const store = new SessionStore();
      store.getOrCreate('user1');
      store.getOrCreate('user2');

      const found = store.findByUser('user2');
      expect(found?.userId).toBe('user2');
    });

    it('should return undefined for non-existent user', () => {
      const store = new SessionStore();
      const found = store.findByUser('nonexistent');
      expect(found).toBeUndefined();
    });

    it('should delete session', () => {
      const store = new SessionStore();
      const session = store.getOrCreate('user1');

      store.delete(session.id);

      expect(store.get(session.id)).toBeUndefined();
      expect(store.size).toBe(0);
    });

    it('should cleanup old sessions', () => {
      const store = new SessionStore();

      // Create sessions with old timestamps
      const session1 = store.getOrCreate('user1');
      const session2 = store.getOrCreate('user2');

      // Manually set old lastActiveAt
      const oldTime = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      store.update(session1.id, {});
      (store as any).sessions.get(session1.id)!.lastActiveAt = oldTime;

      // Cleanup with 1 hour max age
      const cleaned = store.cleanup(60 * 60 * 1000);

      expect(cleaned).toBe(1);
      expect(store.get(session1.id)).toBeUndefined();
      expect(store.get(session2.id)).toBeDefined();
    });

    it('should get all sessions', () => {
      const store = new SessionStore();
      store.getOrCreate('user1');
      store.getOrCreate('user2');
      store.getOrCreate('user3');

      const all = store.getAll();
      expect(all.length).toBe(3);
    });
  });

  describe('persistent mode', () => {
    it('should persist sessions to file', () => {
      const store = new SessionStore(testPath);
      store.getOrCreate('user1');
      store.getOrCreate('user2');

      expect(existsSync(testPath)).toBe(true);
    });

    it('should load sessions from file on init', () => {
      // Create and populate store
      const store1 = new SessionStore(testPath);
      const session = store1.getOrCreate('user1');
      store1.update(session.id, { claudeSessionId: 'claude-123' });

      // Create new store from same file
      const store2 = new SessionStore(testPath);
      const loaded = store2.findByUser('user1');

      expect(loaded).toBeDefined();
      expect(loaded?.claudeSessionId).toBe('claude-123');
    });

    it('should reset running sessions to idle on reload', () => {
      // Create store with running session
      const store1 = new SessionStore(testPath);
      const session = store1.getOrCreate('user1');
      store1.update(session.id, { status: 'running' });

      // Reload store
      const store2 = new SessionStore(testPath);
      const loaded = store2.findByUser('user1');

      expect(loaded?.status).toBe('idle');
    });
  });
});
