/**
 * Pending MCP Questions Registry
 *
 * Tracks questions sent by MCP processes through the Agent.
 * When a user replies on Feishu, the registry matches the reply
 * to the pending question and resolves the waiting Promise.
 */

export interface PendingMcpQuestion {
  mcpRequestId: string;
  feishuMessageId: string;
  sentAt: number;
  question: string;
  userId: string;
  resolve: (reply: string) => void;
  reject: (error: Error) => void;
  timeoutTimer?: ReturnType<typeof setTimeout>;
}

export class PendingMcpQuestionRegistry {
  private questions: Map<string, PendingMcpQuestion> = new Map();

  /**
   * Register a pending question from MCP.
   * Returns a Promise that resolves when the user replies.
   *
   * @param params - Question parameters (without resolve/reject)
   * @returns Promise that resolves to the user's reply
   */
  register(params: {
    mcpRequestId: string;
    feishuMessageId: string;
    question: string;
    userId: string;
    timeoutMs?: number;
  }): Promise<string> {
    return new Promise((resolve, reject) => {
      const question: PendingMcpQuestion = {
        mcpRequestId: params.mcpRequestId,
        feishuMessageId: params.feishuMessageId,
        sentAt: Date.now(),
        question: params.question,
        userId: params.userId,
        resolve,
        reject,
      };

      // Set up timeout if specified
      if (params.timeoutMs && params.timeoutMs > 0) {
        question.timeoutTimer = setTimeout(() => {
          if (this.questions.has(params.mcpRequestId)) {
            this.questions.delete(params.mcpRequestId);
            reject(new Error(`Reply timeout after ${params.timeoutMs}ms`));
          }
        }, params.timeoutMs);
      }

      this.questions.set(params.mcpRequestId, question);
      console.error(
        `[PendingMcpQuestions] Registered question ${params.mcpRequestId} for user ${params.userId}`,
      );
    });
  }

  /**
   * Try to resolve a pending question with a user's reply.
   * Matches the most recent pending question from the given user.
   *
   * @param userId - The user who sent the reply
   * @param content - The reply content
   * @returns true if a pending question was resolved, false otherwise
   */
  tryResolve(userId: string, content: string): boolean {
    // Find the most recent pending question from this user
    let latest: PendingMcpQuestion | null = null;

    for (const question of this.questions.values()) {
      if (question.userId === userId) {
        if (!latest || question.sentAt > latest.sentAt) {
          latest = question;
        }
      }
    }

    if (latest) {
      // Clear timeout timer
      if (latest.timeoutTimer) {
        clearTimeout(latest.timeoutTimer);
      }

      // Remove from registry
      this.questions.delete(latest.mcpRequestId);

      console.error(
        `[PendingMcpQuestions] Resolved question ${latest.mcpRequestId} with reply from user ${userId}`,
      );

      // Resolve the promise
      latest.resolve(content);
      return true;
    }

    return false;
  }

  /**
   * Check if there's a pending question for a given user.
   */
  hasPendingForUser(userId: string): boolean {
    for (const question of this.questions.values()) {
      if (question.userId === userId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get the count of pending questions.
   */
  get size(): number {
    return this.questions.size;
  }

  /**
   * Cancel a specific pending question.
   */
  cancel(mcpRequestId: string, reason: string): boolean {
    const question = this.questions.get(mcpRequestId);
    if (question) {
      if (question.timeoutTimer) {
        clearTimeout(question.timeoutTimer);
      }
      this.questions.delete(mcpRequestId);
      question.reject(new Error(reason));
      return true;
    }
    return false;
  }

  /**
   * Cancel all pending questions for a user.
   */
  cancelAllForUser(userId: string, reason: string): number {
    let count = 0;
    for (const [id, question] of this.questions.entries()) {
      if (question.userId === userId) {
        if (question.timeoutTimer) {
          clearTimeout(question.timeoutTimer);
        }
        this.questions.delete(id);
        question.reject(new Error(reason));
        count++;
      }
    }
    return count;
  }
}
