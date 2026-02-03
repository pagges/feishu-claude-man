import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskManager, type Task } from './task-manager.js';

describe('TaskManager', () => {
  let taskManager: TaskManager;

  beforeEach(() => {
    taskManager = new TaskManager(2, 1000); // 2 concurrent, 1s timeout
  });

  describe('submit', () => {
    it('should create a task with queued status', () => {
      const taskId = taskManager.submit('user1', 'session1', 'hello');
      const task = taskManager.get(taskId);

      expect(task).toBeDefined();
      expect(task?.status).toBe('queued');
      expect(task?.userId).toBe('user1');
      expect(task?.prompt).toBe('hello');
    });

    it('should return unique task IDs', () => {
      const id1 = taskManager.submit('user1', 'session1', 'task1');
      const id2 = taskManager.submit('user1', 'session1', 'task2');

      expect(id1).not.toBe(id2);
    });
  });

  describe('getActiveTaskForUser', () => {
    it('should return queued task for user', () => {
      taskManager.submit('user1', 'session1', 'task1');
      const active = taskManager.getActiveTaskForUser('user1');

      expect(active).toBeDefined();
      expect(active?.userId).toBe('user1');
    });

    it('should return undefined for user with no tasks', () => {
      const active = taskManager.getActiveTaskForUser('nonexistent');
      expect(active).toBeUndefined();
    });
  });

  describe('cancel', () => {
    it('should cancel queued task', () => {
      const taskId = taskManager.submit('user1', 'session1', 'task1');
      const cancelled = taskManager.cancel(taskId);

      expect(cancelled).toBe(true);
      expect(taskManager.get(taskId)?.status).toBe('cancelled');
    });

    it('should return false for non-existent task', () => {
      const cancelled = taskManager.cancel('nonexistent');
      expect(cancelled).toBe(false);
    });

    it('should return false for already completed task', async () => {
      taskManager.setExecutor(async () => 'done');
      const taskId = taskManager.submit('user1', 'session1', 'task1');

      // Wait for task to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const cancelled = taskManager.cancel(taskId);
      expect(cancelled).toBe(false);
    });
  });

  describe('cancelAllForUser', () => {
    it('should cancel all tasks for user', () => {
      taskManager.submit('user1', 'session1', 'task1');
      taskManager.submit('user1', 'session1', 'task2');
      taskManager.submit('user2', 'session2', 'task3');

      const cancelled = taskManager.cancelAllForUser('user1');

      expect(cancelled).toBe(2);
    });
  });

  describe('getStatus', () => {
    it('should return correct queue status', () => {
      taskManager.submit('user1', 'session1', 'task1');
      taskManager.submit('user1', 'session1', 'task2');

      const status = taskManager.getStatus();

      expect(status.total).toBe(2);
    });
  });

  describe('task execution', () => {
    it('should execute tasks with executor', async () => {
      const executor = vi.fn(async () => 'result');
      taskManager.setExecutor(executor);

      const taskId = taskManager.submit('user1', 'session1', 'hello');

      // Wait for task to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const task = taskManager.get(taskId);
      expect(task?.status).toBe('completed');
      expect(task?.result).toBe('result');
      expect(executor).toHaveBeenCalled();
    });

    it('should handle executor errors', async () => {
      const executor = vi.fn(async () => {
        throw new Error('execution failed');
      });
      taskManager.setExecutor(executor);

      const taskId = taskManager.submit('user1', 'session1', 'hello');

      // Wait for task to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const task = taskManager.get(taskId);
      expect(task?.status).toBe('failed');
      expect(task?.error).toBe('execution failed');
    });

    it('should respect max concurrent limit', async () => {
      const executionOrder: string[] = [];
      const executor = vi.fn(async (task: Task) => {
        executionOrder.push(`start-${task.prompt}`);
        await new Promise((resolve) => setTimeout(resolve, 50));
        executionOrder.push(`end-${task.prompt}`);
        return 'done';
      });
      taskManager.setExecutor(executor);

      // Submit 4 tasks with max 2 concurrent
      taskManager.submit('user1', 'session1', 'task1');
      taskManager.submit('user2', 'session2', 'task2');
      taskManager.submit('user3', 'session3', 'task3');
      taskManager.submit('user4', 'session4', 'task4');

      // Wait for all to complete
      await new Promise((resolve) => setTimeout(resolve, 300));

      // First two should start before any ends, then next two
      expect(executionOrder.slice(0, 2)).toContain('start-task1');
      expect(executionOrder.slice(0, 2)).toContain('start-task2');
    });

    it('should timeout long-running tasks', async () => {
      const executor = vi.fn(async (_task: Task, signal: AbortSignal) => {
        // This should be cancelled before completing
        return new Promise<string>((resolve, reject) => {
          const timeoutId = setTimeout(() => resolve('should not reach'), 5000);
          signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new Error('aborted'));
          });
        });
      });
      taskManager.setExecutor(executor);

      const taskId = taskManager.submit('user1', 'session1', 'hello');

      // Wait for timeout (1s) + buffer
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const task = taskManager.get(taskId);
      expect(task?.status).toBe('cancelled');
      expect(task?.error).toContain('timed out');
    });
  });

  describe('cleanup', () => {
    it('should remove old completed tasks', async () => {
      const executor = vi.fn(async () => 'done');
      taskManager.setExecutor(executor);

      const taskId = taskManager.submit('user1', 'session1', 'hello');

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Set old completedAt
      const task = taskManager.get(taskId);
      if (task) {
        task.completedAt = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      }

      // Cleanup with 1 hour max age
      const cleaned = taskManager.cleanup(60 * 60 * 1000);

      expect(cleaned).toBe(1);
      expect(taskManager.get(taskId)).toBeUndefined();
    });

    it('should not remove recent completed tasks', async () => {
      const executor = vi.fn(async () => 'done');
      taskManager.setExecutor(executor);

      const taskId = taskManager.submit('user1', 'session1', 'hello');

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Cleanup with 1 hour max age
      const cleaned = taskManager.cleanup(60 * 60 * 1000);

      expect(cleaned).toBe(0);
      expect(taskManager.get(taskId)).toBeDefined();
    });
  });
});
