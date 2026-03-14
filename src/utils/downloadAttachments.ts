import { tmpdir } from "os";
import { join } from "path";
import { writeFile, unlink } from "fs/promises";
import { randomUUID } from "crypto";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per image
const MAX_IMAGE_COUNT = 5;
const FETCH_TIMEOUT_MS = 30_000; // 30 seconds per image download

export interface DownloadedAttachment {
  filePath: string;
  displayName: string;
}

export interface DownloadResult {
  attachments: DownloadedAttachment[];
  cleanup: () => Promise<void>;
}

/**
 * Downloads image attachments from Discord CDN to temporary local files.
 * Only processes attachments whose content type starts with "image/".
 * Enforces per-image size and count limits, and a per-fetch timeout.
 * Returns the temp file paths and a cleanup function to delete them.
 */
export async function downloadImageAttachments(
  attachments: Iterable<{ url: string; contentType: string | null; name: string; size?: number }>
): Promise<DownloadResult> {
  const downloaded: DownloadedAttachment[] = [];
  let count = 0;

  for (const attachment of attachments) {
    if (!attachment.contentType?.startsWith("image/")) continue;
    if (count >= MAX_IMAGE_COUNT) {
      console.warn(`[downloadAttachments] Skipping excess image (limit: ${MAX_IMAGE_COUNT})`);
      break;
    }

    if (attachment.size !== undefined && attachment.size > MAX_IMAGE_SIZE_BYTES) {
      console.warn(`[downloadAttachments] Skipping oversized image "${attachment.name}" (${attachment.size} bytes)`);
      continue;
    }

    const ext = attachment.name.match(/\.[^.]+$/)?.[0] ?? ".png";
    const tempPath = join(tmpdir(), `discord-img-${randomUUID()}${ext}`);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(attachment.url, { signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        console.warn(`[downloadAttachments] Failed to download "${attachment.name}": HTTP ${response.status}`);
        continue;
      }

      // Guard against server reporting wrong Content-Length or missing size metadata
      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > MAX_IMAGE_SIZE_BYTES) {
        console.warn(`[downloadAttachments] Skipping oversized image "${attachment.name}" (Content-Length: ${contentLength})`);
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
        console.warn(`[downloadAttachments] Skipping oversized image "${attachment.name}" (actual: ${buffer.byteLength} bytes)`);
        continue;
      }

      await writeFile(tempPath, buffer);
      downloaded.push({ filePath: tempPath, displayName: attachment.name });
      count++;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.warn(`[downloadAttachments] Timeout downloading "${attachment.name}"`);
      } else {
        console.warn(`[downloadAttachments] Error downloading "${attachment.name}":`, err);
      }
    }
  }

  return {
    attachments: downloaded,
    cleanup: async () => {
      await Promise.all(downloaded.map((d) => unlink(d.filePath).catch(() => {})));
    },
  };
}
