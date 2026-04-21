export interface DownloadedImage {
  readonly buffer: Buffer;
  readonly contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  readonly originalExtension: 'jpg' | 'png' | 'webp';
  readonly byteLength: number;
}

export interface ProcessedImage {
  /** sharp JPEG output at q=85. */
  readonly jpegBuffer: Buffer;
  /** sharp WebP output at q=80. */
  readonly webpBuffer: Buffer;
  readonly width: number;
  readonly height: number;
}

export interface StoredImagePaths {
  readonly originalPath: string;
  readonly processedJpegPath: string;
  readonly processedWebpPath: string;
}

export type PipelineStatus =
  | 'ok'
  | 'skipped_too_small'
  | 'skipped_unsupported_mime'
  | 'skipped_over_max_size';

export interface PipelineResult {
  readonly status: PipelineStatus;
  readonly sourceUrl: string;
  /** Position in the image list for the EAN (0-indexed). */
  readonly position: number;
  readonly paths: StoredImagePaths | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly warning: string | null;
}
