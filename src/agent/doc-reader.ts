/**
 * Feishu Document Reader
 *
 * Reads Feishu document content via the Open API.
 * Supports both regular docx URLs and wiki URLs.
 */

import * as lark from '@larksuiteoapi/node-sdk';

/**
 * Result of reading a Feishu document.
 */
export interface DocReadResult {
  /** Document title */
  title?: string;
  /** Plain text content of the document */
  content: string;
  /** Document ID used */
  documentId: string;
}

/**
 * Parsed Feishu URL info.
 */
interface ParsedFeishuUrl {
  type: 'docx' | 'wiki' | 'sheet' | 'unknown';
  token: string;
}

/**
 * Regex patterns for Feishu document URLs.
 * Matches: https://xxx.feishu.cn/docx/TOKEN, https://xxx.larksuite.com/wiki/TOKEN, etc.
 */
const FEISHU_URL_PATTERN = /https?:\/\/[^/]*(?:feishu\.cn|larksuite\.com)\/(docx|wiki|sheets|doc)\/([A-Za-z0-9]+)/;

/**
 * Check if a text contains a Feishu document URL.
 */
export function findFeishuDocUrl(text: string): ParsedFeishuUrl | null {
  const match = text.match(FEISHU_URL_PATTERN);
  if (!match) return null;

  const [, urlType, token] = match;
  let type: ParsedFeishuUrl['type'];
  switch (urlType) {
    case 'docx':
    case 'doc':
      type = 'docx';
      break;
    case 'wiki':
      type = 'wiki';
      break;
    case 'sheets':
      type = 'sheet';
      break;
    default:
      type = 'unknown';
  }

  return { type, token };
}

/**
 * Resolve a wiki token to a document ID using the wiki API.
 */
async function resolveWikiToken(
  larkClient: lark.Client,
  wikiToken: string,
): Promise<{ documentId: string; objType: string }> {
  const response = await larkClient.wiki.space.getNode({
    params: {
      token: wikiToken,
      obj_type: 'wiki',
    },
  });

  const node = response?.data?.node;
  if (!node?.obj_token) {
    throw new Error(`Cannot resolve wiki token: ${wikiToken} (code: ${response?.code}, msg: ${response?.msg})`);
  }

  return {
    documentId: node.obj_token,
    objType: node.obj_type || 'docx',
  };
}

/**
 * Read a Feishu document's content.
 *
 * @param larkClient - The Lark SDK client instance
 * @param url - A Feishu document URL or parsed URL info
 * @returns Document content and metadata
 */
export async function readFeishuDoc(
  larkClient: lark.Client,
  url: string | ParsedFeishuUrl,
): Promise<DocReadResult> {
  // Parse URL if string
  const parsed = typeof url === 'string' ? findFeishuDocUrl(url) : url;
  if (!parsed) {
    throw new Error('Invalid Feishu document URL');
  }

  let documentId: string;

  console.log(`[DocReader] Parsed URL: type=${parsed.type}, token=${parsed.token}`);

  // Resolve wiki token if needed
  if (parsed.type === 'wiki') {
    console.log(`[DocReader] Resolving wiki token: ${parsed.token}`);
    const resolved = await resolveWikiToken(larkClient, parsed.token);
    documentId = resolved.documentId;
    console.log(`[DocReader] Wiki resolved to documentId: ${documentId} (type: ${resolved.objType})`);
  } else if (parsed.type === 'docx') {
    documentId = parsed.token;
  } else {
    throw new Error(`Unsupported document type: ${parsed.type}`);
  }

  console.log(`[DocReader] Reading document: ${documentId}`);

  // Get document metadata (title)
  let title: string | undefined;
  try {
    const metaResponse = await larkClient.docx.document.get({
      path: { document_id: documentId },
    });
    title = metaResponse?.data?.document?.title;
    console.log(`[DocReader] Document title: ${title}`);
  } catch (err) {
    console.warn(`[DocReader] Failed to get title:`, err instanceof Error ? err.message : err);
  }

  // Get raw text content
  try {
    const contentResponse = await larkClient.docx.document.rawContent({
      path: { document_id: documentId },
    });

    const content = contentResponse?.data?.content;
    if (content === undefined || content === null) {
      throw new Error(
        `Empty content (code: ${contentResponse?.code}, msg: ${contentResponse?.msg})`,
      );
    }

    console.log(`[DocReader] Read document "${title || documentId}": ${content.length} chars`);

    return { title, content, documentId };
  } catch (error) {
    // Log detailed error info
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[DocReader] rawContent failed for ${documentId}:`, errMsg);

    // Try the blocks API as fallback
    console.log(`[DocReader] Trying blocks API as fallback...`);
    try {
      const blocksResponse = await larkClient.docx.documentBlockChildren.get({
        path: { document_id: documentId, block_id: documentId },
        params: { page_size: 500 },
      });

      const blocks = blocksResponse?.data?.items;
      if (!blocks || blocks.length === 0) {
        throw new Error(`No blocks found (code: ${blocksResponse?.code}, msg: ${blocksResponse?.msg})`);
      }

      // Extract text from blocks
      const textParts: string[] = [];
      for (const block of blocks) {
        const blockAny = block as Record<string, unknown>;
        // Try common text-bearing fields
        const textObj = blockAny.text as { elements?: Array<{ text_run?: { content?: string } }> } | undefined;
        if (textObj?.elements) {
          for (const el of textObj.elements) {
            if (el.text_run?.content) {
              textParts.push(el.text_run.content);
            }
          }
        }
      }

      const content = textParts.join('\n');
      console.log(`[DocReader] Blocks fallback: extracted ${content.length} chars from ${blocks.length} blocks`);

      return { title, content, documentId };
    } catch (fallbackError) {
      console.error(`[DocReader] Blocks fallback also failed:`, fallbackError instanceof Error ? fallbackError.message : fallbackError);
      // Re-throw the original error with more context
      throw new Error(`Document read failed (id: ${documentId}): ${errMsg}`);
    }
  }
}
