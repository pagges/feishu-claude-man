import type { MessageRecord } from './types.js';

const MAX_RECORDS = 100;
const DEFAULT_LIMIT = 20;

/**
 * In-memory message history with FIFO eviction.
 *
 * Stores up to {@link MAX_RECORDS} (100) message records in a ring buffer.
 * When the buffer is full, the oldest record is overwritten.
 */
export class MessageHistory {
  private buffer: (MessageRecord | undefined)[];
  private head: number;
  private size: number;

  constructor() {
    this.buffer = new Array<MessageRecord | undefined>(MAX_RECORDS);
    this.head = 0;
    this.size = 0;
  }

  /**
   * Add a message record to the history.
   *
   * If `id` or `timestamp` are missing from the input, they are automatically
   * generated (UUID and current epoch ms respectively).
   *
   * When the buffer is full the oldest record is evicted.
   */
  add(record: Partial<MessageRecord> & Pick<MessageRecord, 'direction' | 'content'>): MessageRecord {
    const full: MessageRecord = {
      id: record.id ?? crypto.randomUUID(),
      direction: record.direction,
      content: record.content,
      timestamp: record.timestamp ?? Date.now(),
      ...(record.feishuMessageId !== undefined && { feishuMessageId: record.feishuMessageId }),
      ...(record.senderOpenId !== undefined && { senderOpenId: record.senderOpenId }),
      ...(record.sessionId !== undefined && { sessionId: record.sessionId }),
    };

    if (this.size < MAX_RECORDS) {
      // Buffer not full yet, append at (head + size) mod capacity
      this.buffer[(this.head + this.size) % MAX_RECORDS] = full;
      this.size++;
    } else {
      // Buffer full, overwrite oldest (head) and advance head
      this.buffer[this.head] = full;
      this.head = (this.head + 1) % MAX_RECORDS;
    }

    return full;
  }

  /**
   * Return the most recent N records ordered from oldest to newest.
   *
   * @param limit Number of records to return (default 20, clamped to available size).
   */
  getRecent(limit: number = DEFAULT_LIMIT): MessageRecord[] {
    const count = Math.max(0, Math.min(limit, this.size));
    if (count === 0) return [];

    const startOffset = this.size - count;
    const result: MessageRecord[] = [];
    for (let i = 0; i < count; i++) {
      const idx = (this.head + startOffset + i) % MAX_RECORDS;
      result.push(this.buffer[idx] as MessageRecord);
    }
    return result;
  }

  /**
   * Remove all records from the history.
   */
  clear(): void {
    this.buffer = new Array<MessageRecord | undefined>(MAX_RECORDS);
    this.head = 0;
    this.size = 0;
  }

  /**
   * The current number of stored records.
   */
  get length(): number {
    return this.size;
  }
}
