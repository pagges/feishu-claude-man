/**
 * TaskManager - Manages concurrent task execution with queue and throttling.
 */

import type { StoredSession } from './types.js';

/**
 * Task status.
 */
export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * A task in the queue.
 */
export interface Task {
  /** Task ID */
  id: string;
  /** User ID */
  userId: string;
  /** Session ID */
  sessionId: string;
  /** Task prompt/content */
  prompt: string;
  /** Task status */
  status: TaskStatus;
  /** Creation timestamp */
  createdAt: number;
  /** Start timestamp */
  startedAt?: number;
  /** Completion timestamp */
  completedAt?: number;
  /** Result or error message */
  result?: string;
  /** Error message if failed */
  error?: string;
  /** Abort controller for cancellation */
  abortController?: AbortController;
}

/**
 * Task execution function type.
 */
export type TaskExecutor = (task: Task, signal: AbortSignal) => Promise<string | undefined>;

/**
 * TaskManager handles concurrent task execution with configurable limits.
 */
export class TaskManager {
  private readonly maxConcurrent: number;
  private readonly taskTimeoutMs: number;
  private readonly tasks: Map<string, Task> = new Map();
  private readonly queue: string[] = [];
  private runningCount = 0;
  private executor?: TaskExecutor;

  /**
   * Create a new TaskManager.
   *
   * @param maxConcurrent - Maximum concurrent tasks (default: 5)
   * @param taskTimeoutMs - Task timeout in ms (default: 10 minutes)
   */
  constructor(maxConcurrent = 5, taskTimeoutMs = 10 * 60 * 1000) {
    this.maxConcurrent = maxConcurrent;
    this.taskTimeoutMs = taskTimeoutMs;
  }

  /**
   * Set the task executor function.
   * This will also start processing any queued tasks.
   */
  setExecutor(executor: TaskExecutor): void {
    this.executor = executor;
    // Start processing any queued tasks
    this.processQueue();
  }

  /**
   * Submit a new task.
   *
   * @returns The task ID
   */
  submit(userId: string, sessionId: string, prompt: string): string {
    const task: Task = {
      id: crypto.randomUUID(),
      userId,
      sessionId,
      prompt,
      status: 'queued',
      createdAt: Date.now(),
      abortController: new AbortController(),
    };

    this.tasks.set(task.id, task);
    this.queue.push(task.id);
    this.processQueue();

    return task.id;
  }

  /**
   * Get a task by ID.
   */
  get(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get active task for a user.
   */
  getActiveTaskForUser(userId: string): Task | undefined {
    for (const task of this.tasks.values()) {
      if (task.userId === userId && (task.status === 'queued' || task.status === 'running')) {
        return task;
      }
    }
    return undefined;
  }

  /**
   * Cancel a task.
   */
  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === 'queued') {
      // Remove from queue
      const index = this.queue.indexOf(taskId);
      if (index !== -1) {
        this.queue.splice(index, 1);
      }
      task.status = 'cancelled';
      task.completedAt = Date.now();
      return true;
    }

    if (task.status === 'running') {
      // Abort running task
      task.abortController?.abort();
      task.status = 'cancelled';
      task.completedAt = Date.now();
      return true;
    }

    return false;
  }

  /**
   * Cancel all tasks for a user.
   */
  cancelAllForUser(userId: string): number {
    let cancelled = 0;
    for (const task of this.tasks.values()) {
      if (task.userId === userId && (task.status === 'queued' || task.status === 'running')) {
        if (this.cancel(task.id)) {
          cancelled++;
        }
      }
    }
    return cancelled;
  }

  /**
   * Get queue status.
   */
  getStatus(): { queued: number; running: number; total: number } {
    return {
      queued: this.queue.length,
      running: this.runningCount,
      total: this.tasks.size,
    };
  }

  /**
   * Clean up old completed tasks.
   */
  cleanup(maxAgeMs: number = 60 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, task] of this.tasks) {
      if (
        (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') &&
        task.completedAt &&
        now - task.completedAt > maxAgeMs
      ) {
        this.tasks.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Process the task queue.
   */
  private async processQueue(): Promise<void> {
    // Don't process if no executor is set
    if (!this.executor) {
      return;
    }

    while (this.queue.length > 0 && this.runningCount < this.maxConcurrent) {
      const taskId = this.queue.shift();
      if (!taskId) break;

      const task = this.tasks.get(taskId);
      if (!task || task.status !== 'queued') continue;

      this.runningCount++;
      task.status = 'running';
      task.startedAt = Date.now();

      // Run task with timeout
      this.runTask(task).finally(() => {
        this.runningCount--;
        this.processQueue();
      });
    }
  }

  /**
   * Run a single task with timeout.
   */
  private async runTask(task: Task): Promise<void> {
    if (!this.executor) {
      task.status = 'failed';
      task.error = 'No executor configured';
      task.completedAt = Date.now();
      return;
    }

    const timeoutId = setTimeout(() => {
      task.abortController?.abort();
    }, this.taskTimeoutMs);

    try {
      const result = await this.executor(task, task.abortController!.signal);
      task.result = result;
      task.status = 'completed';
    } catch (error) {
      if (task.abortController?.signal.aborted) {
        task.status = 'cancelled';
        task.error = 'Task timed out or was cancelled';
      } else {
        task.status = 'failed';
        task.error = error instanceof Error ? error.message : String(error);
      }
    } finally {
      clearTimeout(timeoutId);
      task.completedAt = Date.now();
    }
  }
}
