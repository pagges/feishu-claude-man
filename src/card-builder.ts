/**
 * Build a Feishu interactive card payload for an ask-style question.
 *
 * The card is display-only (no action buttons). The user is expected
 * to reply by typing text in the chat.
 *
 * Re-exported from smart-card-builder for backwards compatibility.
 */
export { buildAskCard } from './smart-card-builder.js';
