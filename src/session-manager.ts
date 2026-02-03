import type { Session, PendingQuestion } from './types.js';

/**
 * Options for registering a pending question on a session.
 */
export interface RegisterPendingQuestionOpts {
  /** Feishu message ID of the sent question */
  messageId: string;
  /** Question content text */
  content: string;
  /** Timeout in milliseconds. 0 or undefined means no timeout. */
  timeoutMs?: number;
}

/**
 * Manages communication sessions between Claude Code and the MCP Server.
 *
 * Each session can have at most one pending question awaiting a user reply.
 * Sessions are stored in memory and scoped to the lifetime of the process.
 */
export class SessionManager {
  private sessions: Map<string, Session> = new Map();

  /**
   * Internal map of reject functions keyed by PendingQuestion ID.
   * This is necessary because the PendingQuestion type only stores `resolve`.
   */
  private rejectFns: Map<string, (reason: Error) => void> = new Map();

  /**
   * Create a new session with a fresh UUID.
   */
  createSession(): Session {
    const session: Session = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      pendingQuestion: null,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Retrieve a session by its ID.
   *
   * @returns The session, or `undefined` if not found.
   */
  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  /**
   * Destroy a session.
   *
   * If the session has a pending question, its promise is rejected with an
   * error indicating the session was destroyed, and any active timeout timer
   * is cleared.
   */
  destroySession(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;

    if (session.pendingQuestion) {
      this.rejectAndCleanup(session, new Error('Session destroyed'));
    }

    this.sessions.delete(id);
  }

  /**
   * Register a pending question on a session and return a Promise that
   * resolves with the user's reply content.
   *
   * Only one pending question is allowed per session. If there is already a
   * pending question it is rejected before registering the new one.
   *
   * @throws {Error} If the session does not exist.
   */
  registerPendingQuestion(
    sessionId: string,
    opts: RegisterPendingQuestionOpts,
  ): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // If there is already a pending question, reject it first
    if (session.pendingQuestion) {
      this.rejectAndCleanup(session, new Error('Replaced by new question'));
    }

    return new Promise<string>((resolve, reject) => {
      const pq: PendingQuestion = {
        id: crypto.randomUUID(),
        messageId: opts.messageId,
        content: opts.content,
        sentAt: Date.now(),
        resolve,
        timeoutMs: opts.timeoutMs,
      };

      // Store the reject function so rejectAndCleanup can use it
      this.rejectFns.set(pq.id, reject);

      // Set up timeout if requested
      if (opts.timeoutMs && opts.timeoutMs > 0) {
        pq.timeoutTimer = setTimeout(() => {
          // Only reject if this question is still pending on the session
          if (session.pendingQuestion === pq) {
            session.pendingQuestion = null;
            this.rejectFns.delete(pq.id);
            reject(new Error(`Reply timeout after ${opts.timeoutMs}ms`));
          }
        }, opts.timeoutMs);
      }

      session.pendingQuestion = pq;
    });
  }

  /**
   * Match a reply to the most recent pending question across all sessions.
   *
   * Resolves the pending question's promise with the provided content,
   * clears the timeout timer, and removes the pending question from
   * the session.
   *
   * @returns `true` if a pending question was found and resolved, `false` otherwise.
   */
  resolveReply(content: string): boolean {
    // Find the most recent pending question (latest sentAt) across all sessions
    let latestSession: Session | null = null;
    let latestPq: PendingQuestion | null = null;

    for (const session of this.sessions.values()) {
      if (session.pendingQuestion) {
        if (!latestPq || session.pendingQuestion.sentAt > latestPq.sentAt) {
          latestSession = session;
          latestPq = session.pendingQuestion;
        }
      }
    }

    if (!latestSession || !latestPq) {
      return false;
    }

    // Clear timeout timer if set
    if (latestPq.timeoutTimer) {
      clearTimeout(latestPq.timeoutTimer);
    }

    // Clean up reject function
    this.rejectFns.delete(latestPq.id);

    // Clear pending question from session before resolving
    latestSession.pendingQuestion = null;

    // Resolve the promise
    latestPq.resolve(content);

    return true;
  }

  /**
   * Check whether any session has a pending question.
   */
  hasPendingQuestion(): boolean {
    for (const session of this.sessions.values()) {
      if (session.pendingQuestion) {
        return true;
      }
    }
    return false;
  }

  /**
   * Reject a session's pending question and clean up its timeout timer.
   */
  private rejectAndCleanup(session: Session, error: Error): void {
    const pq = session.pendingQuestion;
    if (!pq) return;

    if (pq.timeoutTimer) {
      clearTimeout(pq.timeoutTimer);
    }

    session.pendingQuestion = null;

    const rejectFn = this.rejectFns.get(pq.id);
    this.rejectFns.delete(pq.id);
    rejectFn?.(error);
  }
}
