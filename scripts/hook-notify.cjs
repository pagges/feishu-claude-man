#!/usr/bin/env node

/**
 * Claude Code Hook Notification Script
 *
 * Sends rich Feishu card notifications when Claude Code hooks fire.
 * Reads hook context from stdin (JSON) and credentials from .mcp.json.
 *
 * Usage (in .claude/settings.json):
 *   "command": "node scripts/hook-notify.js"
 */

const fs = require('fs');
const path = require('path');

// Read credentials from .mcp.json
function loadCredentials() {
  const mcpPath = path.resolve(__dirname, '..', '.mcp.json');
  try {
    const mcpConfig = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    const env = mcpConfig.mcpServers?.['feishu-bridge']?.env || {};
    return {
      appId: env.FEISHU_APP_ID,
      appSecret: env.FEISHU_APP_SECRET,
      userId: env.FEISHU_USER_ID,
    };
  } catch {
    return null;
  }
}

// Build card based on notification type
function buildCard(type, title, message) {
  const templates = {
    permission_prompt: { color: 'orange', heading: '权限申请' },
    idle_prompt: { color: 'blue', heading: '等待输入' },
    stop: { color: 'green', heading: '任务完成' },
  };

  const tpl = templates[type] || { color: 'grey', heading: 'Claude Code 通知' };
  const heading = title || tpl.heading;

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: 'plain_text', content: heading },
      template: tpl.color,
    },
    elements: [
      {
        tag: 'markdown',
        content: message || '(无详细信息)',
      },
      {
        tag: 'hr',
      },
      {
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content:
              type === 'permission_prompt'
                ? '请在终端确认权限'
                : type === 'idle_prompt'
                  ? '请在终端或飞书回复'
                  : '无需操作',
          },
        ],
      },
    ],
  };
}

// Send message via Feishu API
async function sendFeishuCard(credentials, card) {
  const { Client } = require('@larksuiteoapi/node-sdk');
  const client = new Client({
    appId: credentials.appId,
    appSecret: credentials.appSecret,
  });

  await client.im.message.create({
    data: {
      receive_id: credentials.userId,
      msg_type: 'interactive',
      content: JSON.stringify(card),
    },
    params: { receive_id_type: 'open_id' },
  });
}

// Main
async function main() {
  const credentials = loadCredentials();
  if (!credentials || !credentials.appId || !credentials.userId) {
    process.exit(0); // silently skip if no credentials
  }

  // Read stdin (Claude Code passes hook context as JSON)
  let stdinData = '';
  await new Promise((resolve) => {
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      stdinData += chunk;
    });
    process.stdin.on('end', resolve);
    // Handle no stdin (pipe closed immediately)
    setTimeout(resolve, 1000);
  });

  let context = {};
  try {
    context = JSON.parse(stdinData);
  } catch {
    // no valid JSON from stdin, use defaults
  }

  const type = context.notification_type || 'unknown';
  const title = context.title || '';
  const message = context.message || '';

  const card = buildCard(type, title, message);

  try {
    await sendFeishuCard(credentials, card);
  } catch {
    // silently fail — hook should not block Claude
  }

  process.exit(0);
}

main();
