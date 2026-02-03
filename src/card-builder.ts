/**
 * Build a Feishu interactive card payload for an ask-style question.
 *
 * The card is display-only (no action buttons). The user is expected
 * to reply by typing text in the chat.
 */
export function buildAskCard(question: string): object {
  return {
    config: {
      wide_screen_mode: true,
    },
    header: {
      title: {
        tag: 'plain_text',
        content: 'Claude 需要你的确认',
      },
      template: 'blue',
    },
    elements: [
      {
        tag: 'markdown',
        content: question,
      },
      {
        tag: 'hr',
      },
      {
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: '请直接回复数字或文字',
          },
        ],
      },
    ],
  };
}
