import { downloadImage } from './downloader';
import { ImageError } from './errors';
import { MAX_OUTPUT_BYTES, processImage } from './processor';
import { createImageStorage, type ImageStorageConfig } from './storage';
import type { PipelineResult } from './types';

export const MAX_IMAGES_PER_LISTING = 12;

export interface PipelineInput {
  readonly url: string;
  readonly position: number;
}

export interface PipelineOptions {
  readonly ean: string;
  readonly storage: ImageStorageConfig;
}

/**
 * Run the full image pipeline for one image: download → process → persist.
 * Returns a classified result:
 *   - `ok`: both original and processed files on disk
 *   - `skipped_too_small`: image below 500×500 threshold
 *   - `skipped_unsupported_mime`: content-type not in jpeg/png/webp
 *   - `skipped_over_max_size`: processed JPEG exceeds eBay EPS 5MB limit
 *
 * Infrastructure errors (404s, network failures, corrupt buffers) propagate
 * as `ImageError` — caller decides whether to abort or continue.
 */
export async function processOneImage(
  input: PipelineInput,
  options: PipelineOptions
): Promise<PipelineResult> {
  const storage = createImageStorage(options.storage);

  let downloaded;
  try {
    downloaded = await downloadImage(input.url);
  } catch (error) {
    if (error instanceof ImageError && error.context.contentType !== undefined) {
      return {
        status: 'skipped_unsupported_mime',
        sourceUrl: input.url,
        position: input.position,
        paths: null,
        width: null,
        height: null,
        warning: `unsupported_mime:${error.context.contentType as string}`,
      };
    }
    throw error;
  }

  const processed = await processImage(downloaded.buffer);

  if ('status' in processed) {
    return {
      status: 'skipped_too_small',
      sourceUrl: input.url,
      position: input.position,
      paths: null,
      width: processed.width,
      height: processed.height,
      warning: `too_small:${processed.width}x${processed.height}`,
    };
  }

  if ('jpegBuffer' in processed && processed.jpegBuffer.byteLength > MAX_OUTPUT_BYTES) {
    return {
      status: 'skipped_over_max_size',
      sourceUrl: input.url,
      position: input.position,
      paths: null,
      width: processed.width,
      height: processed.height,
      warning: `oversize:${processed.jpegBuffer.byteLength}`,
    };
  }

  if (!('jpegBuffer' in processed)) {
    // Defensive — should be unreachable since the only other variant is skipped_too_small handled above.
    throw new ImageError('Unexpected processor output shape', { sourceUrl: input.url });
  }

  const originalPath = await storage.saveOriginal(options.ean, input.position, downloaded);
  const processedPaths = await storage.saveProcessed(options.ean, input.position, processed);

  return {
    status: 'ok',
    sourceUrl: input.url,
    position: input.position,
    paths: { ...processedPaths, originalPath },
    width: processed.width,
    height: processed.height,
    warning: null,
  };
}

/**
 * Batch-process all images for a listing. Caps at 12 per eBay's hard limit.
 * Runs in parallel — each image is independent. Failed downloads are
 * surfaced as errors in the returned array position, but one failure does not
 * abort the others.
 */
export async function processAllImages(
  urls: readonly string[],
  options: PipelineOptions
): Promise<PipelineResult[]> {
  const inputs = urls.slice(0, MAX_IMAGES_PER_LISTING).map((url, position) => ({ url, position }));

  return Promise.all(inputs.map((input) => processOneImage(input, options)));
}
