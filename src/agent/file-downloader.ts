/**
 * File downloader for Feishu message resources.
 *
 * Downloads files, images, and other resources from Feishu messages
 * using the Lark SDK and saves them to a local temp directory.
 */

import * as lark from '@larksuiteoapi/node-sdk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/** Directory for downloaded Feishu files */
const DOWNLOAD_DIR = path.join(os.tmpdir(), 'feishu-claude-files');

/**
 * Ensure the download directory exists.
 */
function ensureDownloadDir(): void {
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }
}

/**
 * Resource type for the Feishu download API.
 */
export type ResourceType = 'file' | 'image';

/**
 * Result of a file download operation.
 */
export interface DownloadResult {
  /** Local file path where the file was saved */
  filePath: string;
  /** Original file name (may be undefined for images) */
  fileName?: string;
  /** Resource type */
  resourceType: ResourceType;
}

/**
 * Download a resource (file or image) from a Feishu message.
 *
 * @param larkClient - The Lark SDK client instance
 * @param messageId - The Feishu message ID containing the resource
 * @param fileKey - The file_key or image_key from the message content
 * @param resourceType - 'file' or 'image'
 * @param originalFileName - Optional original file name for preserving extension
 * @returns Download result with local file path
 */
export async function downloadResource(
  larkClient: lark.Client,
  messageId: string,
  fileKey: string,
  resourceType: ResourceType,
  originalFileName?: string,
): Promise<DownloadResult> {
  ensureDownloadDir();

  // Determine local file name
  const timestamp = Date.now();
  let localFileName: string;

  if (originalFileName) {
    // Preserve original extension, prefix with timestamp to avoid collisions
    const ext = path.extname(originalFileName);
    const base = path.basename(originalFileName, ext);
    localFileName = `${timestamp}-${base}${ext}`;
  } else if (resourceType === 'image') {
    // Default extension for images
    localFileName = `${timestamp}-image.png`;
  } else {
    localFileName = `${timestamp}-file`;
  }

  const localPath = path.join(DOWNLOAD_DIR, localFileName);

  // Download using the Lark SDK
  const response = await larkClient.im.messageResource.get({
    params: { type: resourceType },
    path: {
      message_id: messageId,
      file_key: fileKey,
    },
  });

  // Write to local file
  await response.writeFile(localPath);

  console.log(`[FileDownloader] Downloaded ${resourceType} to ${localPath}`);

  return {
    filePath: localPath,
    fileName: originalFileName,
    resourceType,
  };
}

/**
 * Clean up old downloaded files (older than the specified age).
 *
 * @param maxAgeMs - Maximum age in milliseconds (default: 1 hour)
 */
export function cleanupOldFiles(maxAgeMs = 60 * 60 * 1000): number {
  if (!fs.existsSync(DOWNLOAD_DIR)) return 0;

  const now = Date.now();
  let cleaned = 0;

  const files = fs.readdirSync(DOWNLOAD_DIR);
  for (const file of files) {
    const filePath = path.join(DOWNLOAD_DIR, file);
    try {
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    } catch {
      // Ignore errors during cleanup
    }
  }

  if (cleaned > 0) {
    console.log(`[FileDownloader] Cleaned up ${cleaned} old files`);
  }

  return cleaned;
}
