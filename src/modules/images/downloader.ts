import { request } from 'undici';
import { HTTP_TIMEOUTS } from '../../config/constants';
import { ImageError } from './errors';
import type { DownloadedImage } from './types';

const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MIME_TO_EXT: Record<(typeof SUPPORTED_MIME_TYPES)[number], 'jpg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function extractContentType(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return raw[0]?.toLowerCase().split(';')[0]?.trim() ?? '';
  return raw?.toLowerCase().split(';')[0]?.trim() ?? '';
}

function isSupportedMime(mime: string): mime is (typeof SUPPORTED_MIME_TYPES)[number] {
  return (SUPPORTED_MIME_TYPES as readonly string[]).includes(mime);
}

/**
 * Fetch an image over HTTP. Enforces:
 *   - HTTP 200 (redirects followed by undici automatically)
 *   - Content-Type in the jpeg/png/webp whitelist (GIF/SVG/BMP excluded —
 *     eBay EPS accepts them but we avoid format surprises)
 *   - Explicit timeout (undici default is long; image hosts can hang)
 *
 * Throws `ImageError` on transport failure or unsupported MIME so the
 * pipeline can classify the outcome and keep going with the next image.
 */
export async function downloadImage(url: string): Promise<DownloadedImage> {
  const { statusCode, headers, body } = await request(url, {
    method: 'GET',
    bodyTimeout: HTTP_TIMEOUTS.imageDownload,
    headersTimeout: HTTP_TIMEOUTS.imageDownload,
  });

  if (statusCode < 200 || statusCode >= 300) {
    throw new ImageError(`Image fetch failed with HTTP ${statusCode}`, { url, statusCode });
  }

  const contentType = extractContentType(headers['content-type']);
  if (!isSupportedMime(contentType)) {
    throw new ImageError(`Unsupported image MIME type: ${contentType}`, { url, contentType });
  }

  const arrayBuffer = await body.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return {
    buffer,
    contentType,
    originalExtension: MIME_TO_EXT[contentType],
    byteLength: buffer.byteLength,
  };
}
