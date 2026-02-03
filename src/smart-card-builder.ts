/**
 * Smart Card Builder - 智能飞书消息卡片构建器
 *
 * 自动识别内容类型和消息语义，构建最适合的卡片结构。
 */

/**
 * 消息语义类型
 */
export type MessageSemantic =
  | 'success'   // 成功消息 - 绿色
  | 'error'     // 错误消息 - 红色
  | 'warning'   // 警告消息 - 橙色
  | 'info'      // 信息消息 - 蓝色
  | 'progress'  // 进度消息 - 靛蓝色
  | 'help'      // 帮助消息 - 紫色
  | 'default';  // 默认消息 - 灰色

/**
 * 内容块类型
 */
interface ContentBlock {
  type: 'markdown' | 'code' | 'divider' | 'note';
  content: string;
  language?: string;
}

/**
 * 卡片配置选项
 */
export interface CardOptions {
  /** 强制指定语义类型，不自动识别 */
  semantic?: MessageSemantic;
  /** 自定义标题 */
  title?: string;
  /** 是否显示时间戳 */
  showTimestamp?: boolean;
  /** 底部备注文本 */
  footer?: string;
  /** 是否紧凑模式（无 header） */
  compact?: boolean;
}

/**
 * 语义类型对应的飞书卡片模板颜色
 */
const SEMANTIC_TEMPLATES: Record<MessageSemantic, string> = {
  success: 'green',
  error: 'red',
  warning: 'orange',
  info: 'blue',
  progress: 'indigo',
  help: 'purple',
  default: 'grey',
};

/**
 * 语义类型对应的默认标题
 */
const SEMANTIC_TITLES: Record<MessageSemantic, string> = {
  success: '✅ 执行成功',
  error: '❌ 执行出错',
  warning: '⚠️ 注意',
  info: 'ℹ️ 信息',
  progress: '🔄 处理中',
  help: '📖 帮助',
  default: '💬 Claude',
};

/**
 * 自动识别消息的语义类型
 */
export function detectSemantic(content: string): MessageSemantic {
  const trimmed = content.trim();
  const firstLine = trimmed.split('\n')[0].toLowerCase();

  // 基于开头图标识别
  if (trimmed.startsWith('✅') || trimmed.startsWith('✓')) return 'success';
  if (trimmed.startsWith('❌') || trimmed.startsWith('✗')) return 'error';
  if (trimmed.startsWith('⚠️') || trimmed.startsWith('⚠')) return 'warning';
  if (trimmed.startsWith('🔄') || trimmed.startsWith('⏳')) return 'progress';
  if (trimmed.startsWith('ℹ️') || trimmed.startsWith('📖') || trimmed.startsWith('🤖')) return 'help';

  // 基于关键词识别
  if (firstLine.includes('成功') || firstLine.includes('完成') || firstLine.includes('done')) {
    return 'success';
  }
  if (firstLine.includes('错误') || firstLine.includes('失败') || firstLine.includes('error') || firstLine.includes('failed')) {
    return 'error';
  }
  if (firstLine.includes('警告') || firstLine.includes('注意') || firstLine.includes('warning')) {
    return 'warning';
  }
  if (firstLine.includes('处理中') || firstLine.includes('执行中') || firstLine.includes('loading') || firstLine.includes('processing')) {
    return 'progress';
  }
  if (firstLine.includes('帮助') || firstLine.includes('命令') || firstLine.includes('help') || firstLine.includes('usage')) {
    return 'help';
  }

  return 'default';
}

/**
 * 检测内容是否包含代码块
 */
function hasCodeBlock(content: string): boolean {
  return content.includes('```');
}

/**
 * 检测内容是否包含列表
 */
function hasList(content: string): boolean {
  const lines = content.split('\n');
  return lines.some(line => {
    const trimmed = line.trim();
    return /^[-*•]\s/.test(trimmed) || /^\d+[.)]\s/.test(trimmed);
  });
}

/**
 * 检测内容是否包含表格
 */
function hasTable(content: string): boolean {
  const lines = content.split('\n');
  return lines.some(line => line.includes('|') && line.trim().startsWith('|'));
}

/**
 * 检测内容是否需要使用卡片格式
 */
export function needsCardFormat(content: string): boolean {
  // 总是使用卡片格式以获得更好的展示效果
  // 但对于非常短的纯文本消息，可以考虑使用简单文本
  if (content.length < 50 && !content.includes('\n') && !hasCodeBlock(content)) {
    // 检查是否只是简单状态消息
    const simplePatterns = [
      /^[✓✅] .{1,30}$/,  // 简单确认
      /^[⏳🔄] .{1,30}$/, // 简单进度
    ];
    if (simplePatterns.some(p => p.test(content.trim()))) {
      return false;
    }
  }
  return true;
}

/**
 * 提取并清理首行作为潜在标题
 */
function extractTitle(content: string, semantic: MessageSemantic): string | null {
  const lines = content.trim().split('\n');
  const firstLine = lines[0].trim();

  // 如果首行是 Markdown 标题格式
  const headingMatch = firstLine.match(/^#{1,3}\s+(.+)$/);
  if (headingMatch) {
    return headingMatch[1];
  }

  // 如果首行包含语义图标且较短，可以作为标题
  if (firstLine.length <= 40 && /^[✅❌⚠️🔄⏳ℹ️📖🤖💬📊]/.test(firstLine)) {
    return firstLine;
  }

  // 如果首行是粗体格式
  const boldMatch = firstLine.match(/^\*\*(.+)\*\*$/);
  if (boldMatch) {
    return boldMatch[1];
  }

  return null;
}

/**
 * 从内容中移除已用作标题的首行
 */
function removeFirstLine(content: string): string {
  const lines = content.trim().split('\n');
  if (lines.length <= 1) return '';
  return lines.slice(1).join('\n').trim();
}

/**
 * 格式化代码块，确保语法高亮正确
 */
function formatCodeBlocks(content: string): string {
  // 飞书卡片 markdown 支持的语言
  const supportedLanguages = [
    'javascript', 'js', 'typescript', 'ts', 'python', 'py',
    'java', 'go', 'rust', 'c', 'cpp', 'csharp', 'cs',
    'ruby', 'php', 'swift', 'kotlin', 'scala',
    'html', 'css', 'scss', 'less', 'json', 'yaml', 'xml',
    'sql', 'bash', 'sh', 'shell', 'powershell',
    'markdown', 'md', 'plaintext', 'text',
  ];

  // 替换代码块，确保语言标识正确
  return content.replace(/```(\w*)\n/g, (match, lang) => {
    const normalizedLang = lang.toLowerCase();
    if (!lang || !supportedLanguages.includes(normalizedLang)) {
      return '```plaintext\n';
    }
    return match;
  });
}

/**
 * 将 Markdown 表格转换为飞书支持的格式
 * 飞书 markdown 不支持表格，转为键值对列表
 */
function convertTable(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inTable = false;
  let headers: string[] = [];
  let tableRows: string[][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 检测表格行
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // 跳过分隔行 |---|---| （只包含 |、-、:、空格）
      if (/^[\s|:-]+$/.test(trimmed) && trimmed.includes('-')) {
        continue;
      }

      const cells = trimmed
        .slice(1, -1) // 去掉首尾的 |
        .split('|')
        .map(c => c.trim());

      if (!inTable) {
        // 第一行是表头
        inTable = true;
        headers = cells;
      } else {
        // 数据行
        tableRows.push(cells);
      }
    } else {
      // 非表格行，先输出已收集的表格
      if (inTable && tableRows.length > 0) {
        result.push(formatTableAsText(headers, tableRows));
        inTable = false;
        headers = [];
        tableRows = [];
      }
      result.push(line);
    }
  }

  // 处理文件末尾的表格
  if (inTable && tableRows.length > 0) {
    result.push(formatTableAsText(headers, tableRows));
  }

  return result.join('\n');
}

/**
 * 将表格数据格式化为文本列表
 */
function formatTableAsText(headers: string[], rows: string[][]): string {
  const lines: string[] = [];

  // 对于两列表格（常见的 key-value 形式），使用简洁格式
  if (headers.length === 2) {
    for (const row of rows) {
      if (row[0] && row[1]) {
        lines.push(`• **${row[0]}**：${row[1]}`);
      } else if (row[0]) {
        lines.push(`• ${row[0]}`);
      }
    }
  } else {
    // 多列表格，显示完整的 header: value 格式
    for (const row of rows) {
      const items: string[] = [];
      for (let i = 0; i < row.length && i < headers.length; i++) {
        if (row[i]) {
          items.push(`**${headers[i]}**: ${row[i]}`);
        }
      }
      if (items.length > 0) {
        lines.push(`• ${items.join(' | ')}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * 转换飞书不支持的 Markdown 语法
 */
function convertUnsupportedMarkdown(content: string): string {
  let result = content;

  // 1. 转换标题 ### 为粗体（飞书 markdown 不支持 # 标题）
  result = result.replace(/^#{1,6}\s+(.+)$/gm, '**$1**');

  // 2. 转换表格
  if (hasTable(result)) {
    result = convertTable(result);
  }

  // 3. 确保列表格式正确（飞书支持 - 但有时候渲染有问题）
  // 统一使用 • 符号
  result = result.replace(/^(\s*)[-*]\s+/gm, '$1• ');

  return result;
}

/**
 * 构建飞书交互式卡片
 */
export function buildSmartCard(content: string, options: CardOptions = {}): object {
  const semantic = options.semantic || detectSemantic(content);
  const template = SEMANTIC_TEMPLATES[semantic];

  // 处理标题
  let title = options.title;
  let bodyContent = content;

  if (!title && !options.compact) {
    const extractedTitle = extractTitle(content, semantic);
    if (extractedTitle) {
      title = extractedTitle;
      bodyContent = removeFirstLine(content);
    } else {
      // 使用默认标题
      title = SEMANTIC_TITLES[semantic];
    }
  }

  // 格式化内容：转换不支持的 Markdown 语法
  bodyContent = bodyContent.trim();
  bodyContent = convertUnsupportedMarkdown(bodyContent);
  bodyContent = formatCodeBlocks(bodyContent);

  // 构建元素列表
  const elements: object[] = [];

  // 主体内容
  if (bodyContent) {
    elements.push({
      tag: 'markdown',
      content: bodyContent,
    });
  }

  // 添加分隔线和底部信息
  if (options.footer || options.showTimestamp) {
    elements.push({ tag: 'hr' });

    const footerParts: string[] = [];
    if (options.footer) {
      footerParts.push(options.footer);
    }
    if (options.showTimestamp) {
      const now = new Date().toLocaleString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      footerParts.push(now);
    }

    elements.push({
      tag: 'note',
      elements: [
        {
          tag: 'plain_text',
          content: footerParts.join(' · '),
        },
      ],
    });
  }

  // 构建卡片
  const card: Record<string, unknown> = {
    config: {
      wide_screen_mode: true,
    },
    elements,
  };

  // 添加 header（非紧凑模式）
  if (!options.compact && title) {
    card.header = {
      title: {
        tag: 'plain_text',
        content: title,
      },
      template,
    };
  }

  return card;
}

/**
 * 构建简单的状态卡片（用于确认、进度等短消息）
 */
export function buildStatusCard(
  content: string,
  semantic: MessageSemantic = 'default',
): object {
  return buildSmartCard(content, {
    semantic,
    compact: true,
  });
}

/**
 * 构建结果卡片（带耗时和统计信息）
 */
export function buildResultCard(
  content: string,
  stats?: { duration?: string; summary?: string },
): object {
  const semantic = detectSemantic(content);

  // 构建 footer
  const footerParts: string[] = [];
  if (stats?.duration) {
    footerParts.push(`耗时: ${stats.duration}`);
  }
  if (stats?.summary) {
    footerParts.push(stats.summary);
  }

  return buildSmartCard(content, {
    semantic,
    footer: footerParts.length > 0 ? footerParts.join(' | ') : undefined,
  });
}

/**
 * 构建错误卡片
 */
export function buildErrorCard(
  errorMessage: string,
  suggestion?: string,
): object {
  let content = errorMessage;
  if (suggestion) {
    content += `\n\n💡 **建议**：${suggestion}`;
  }

  return buildSmartCard(content, {
    semantic: 'error',
    title: '❌ 执行出错',
  });
}

/**
 * 构建帮助卡片
 */
export function buildHelpCard(content: string, title?: string): object {
  return buildSmartCard(content, {
    semantic: 'help',
    title: title || '📖 帮助',
  });
}

/**
 * 构建进度卡片
 */
export function buildProgressCard(content: string): object {
  return buildSmartCard(content, {
    semantic: 'progress',
    compact: true,
  });
}

/**
 * 构建询问卡片（用于 feishu_ask）
 */
export function buildAskCard(question: string): object {
  // 转换不支持的 Markdown 语法
  const formattedQuestion = convertUnsupportedMarkdown(question);

  return {
    config: {
      wide_screen_mode: true,
    },
    header: {
      title: {
        tag: 'plain_text',
        content: '🤔 Claude 需要你的确认',
      },
      template: 'blue',
    },
    elements: [
      {
        tag: 'markdown',
        content: formattedQuestion,
      },
      {
        tag: 'hr',
      },
      {
        tag: 'note',
        elements: [
          {
            tag: 'plain_text',
            content: '💬 请直接回复文字或数字',
          },
        ],
      },
    ],
  };
}
