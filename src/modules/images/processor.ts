import sharp from 'sharp';
import { ImageError } from './errors';
import type { ProcessedImage } from './types';

/** Minimum dimensions — images below this are rejected. */
export const MIN_SIDE_PX = 500;
/** Target longest-side for resize (upper bound; smaller images stay smaller). */
const TARGET_LONGEST_SIDE_PX = 1600;
/** eBay EPS upload limit. */
export const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;

const JPEG_QUALITY = 85;
const WEBP_QUALITY = 80;

export interface ProcessImageOptions {
  /** Override min-side threshold (tests pass smaller values to exercise resize). */
  readonly minSidePx?: number;
}

/**
 * Process a raw image buffer according to the spec:
 *   1. Read metadata; reject if shorter side < MIN_SIDE_PX (spec: "kleinere → skip").
 *   2. Resize so longest side == min(TARGET_LONGEST_SIDE_PX, originalLongest).
 *      NEVER upscale — small images keep their resolution.
 *   3. If the resulting aspect is non-square: pad with white to 1600×1600.
 *   4. Strip EXIF (no `.withMetadata()` call — sharp default drops it).
 *   5. Emit both JPEG (q=85) and WebP (q=80). Use the JPEG for EPS,
 *      WebP for Discord embed previews and future CDN serving.
 *
 * Throws `ImageError` on invalid/corrupt buffers (sharp can't read metadata).
 */
export async function processImage(
  buffer: Buffer,
  options: ProcessImageOptions = {}
): Promise<ProcessedImage | { status: 'skipped_too_small'; width: number; height: number }> {
  const minSide = options.minSidePx ?? MIN_SIDE_PX;

  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch (cause) {
    throw new ImageError(
      'Could not read image metadata (corrupt or non-image buffer)',
      { byteLength: buffer.byteLength },
      { cause }
    );
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width < minSide || height < minSide) {
    return { status: 'skipped_too_small', width, height };
  }

  const longest = Math.max(width, height);
  const resizeTarget = Math.min(longest, TARGET_LONGEST_SIDE_PX);

  let pipeline = sharp(buffer).rotate(); // respect EXIF orientation before stripping

  if (longest > resizeTarget) {
    pipeline = pipeline.resize({
      width: width >= height ? resizeTarget : undefined,
      height: height > width ? resizeTarget : undefined,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Pad non-square results to TARGET_LONGEST_SIDE_PX square with white background.
  // For small square images, the padding would upscale — skip in that case per spec:
  // "Pad zu 1600×1600 … wenn nicht quadratisch".
  const resizedMeta = await pipeline
    .clone()
    .toBuffer({ resolveWithObject: true })
    .then((r) => r.info);
  if (resizedMeta.width !== resizedMeta.height) {
    pipeline = pipeline.resize({
      width: TARGET_LONGEST_SIDE_PX,
      height: TARGET_LONGEST_SIDE_PX,
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    });
  }

  // sharp by default strips metadata unless `.withMetadata()` is called.
  const jpegBuffer = await pipeline.clone().jpeg({ quality: JPEG_QUALITY }).toBuffer();
  const webpBuffer = await pipeline.clone().webp({ quality: WEBP_QUALITY }).toBuffer();

  const finalMeta = await sharp(jpegBuffer).metadata();

  return {
    jpegBuffer,
    webpBuffer,
    width: finalMeta.width ?? TARGET_LONGEST_SIDE_PX,
    height: finalMeta.height ?? TARGET_LONGEST_SIDE_PX,
  };
}
