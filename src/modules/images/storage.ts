import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DownloadedImage, ProcessedImage, StoredImagePaths } from './types';

export interface ImageStorageConfig {
  /** Absolute or cwd-relative root for `{ean}/original|processed/*.ext`. */
  readonly rootPath: string;
}

function formatIndex(index: number): string {
  return index.toString().padStart(2, '0');
}

/**
 * Filesystem-backed image storage. Layout per spec:
 *   `{root}/{ean}/original/{NN}.{ext}` — raw bytes from the source
 *   `{root}/{ean}/processed/{NN}.jpg` — processed JPEG (q=85)
 *   `{root}/{ean}/processed/{NN}.webp` — processed WebP (q=80)
 * NN is a 2-digit zero-padded index matching the image position in the listing.
 */
export function createImageStorage(config: ImageStorageConfig): {
  saveOriginal: (ean: string, index: number, image: DownloadedImage) => Promise<string>;
  saveProcessed: (ean: string, index: number, image: ProcessedImage) => Promise<StoredImagePaths>;
  pathsFor: (ean: string, index: number, ext: string) => string;
} {
  return {
    async saveOriginal(ean, index, image) {
      const dir = join(config.rootPath, ean, 'original');
      await mkdir(dir, { recursive: true });
      const path = join(dir, `${formatIndex(index)}.${image.originalExtension}`);
      await writeFile(path, image.buffer);
      return path;
    },

    async saveProcessed(ean, index, image) {
      const dir = join(config.rootPath, ean, 'processed');
      await mkdir(dir, { recursive: true });
      const jpegPath = join(dir, `${formatIndex(index)}.jpg`);
      const webpPath = join(dir, `${formatIndex(index)}.webp`);
      await Promise.all([
        writeFile(jpegPath, image.jpegBuffer),
        writeFile(webpPath, image.webpBuffer),
      ]);
      const originalPath = join(config.rootPath, ean, 'original', `${formatIndex(index)}.tmp`);
      // originalPath is returned as a placeholder here — real value is the one
      // returned by saveOriginal. The orchestrator composes both into StoredImagePaths.
      return { originalPath, processedJpegPath: jpegPath, processedWebpPath: webpPath };
    },

    pathsFor(ean, index, ext) {
      return join(config.rootPath, ean, 'processed', `${formatIndex(index)}.${ext}`);
    },
  };
}
