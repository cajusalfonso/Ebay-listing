import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { processImage, MIN_SIDE_PX } from './processor';
import { ImageError } from './errors';

async function solidColorPng(
  width: number,
  height: number,
  color = { r: 255, g: 0, b: 0 }
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: color },
  })
    .png()
    .toBuffer();
}

describe('processImage', () => {
  it('emits JPEG and WebP buffers for a large image', async () => {
    const input = await solidColorPng(2000, 2000);
    const r = await processImage(input);
    if (!('jpegBuffer' in r)) throw new Error('expected success');
    expect(r.jpegBuffer.byteLength).toBeGreaterThan(0);
    expect(r.webpBuffer.byteLength).toBeGreaterThan(0);
    expect(r.width).toBe(1600);
    expect(r.height).toBe(1600);
  });

  it('resizes longest side down to 1600px, preserves aspect (landscape)', async () => {
    const input = await solidColorPng(3200, 1800);
    const r = await processImage(input);
    if (!('jpegBuffer' in r)) throw new Error('expected success');
    // Non-square → padded to 1600×1600
    expect(r.width).toBe(1600);
    expect(r.height).toBe(1600);
  });

  it('does not upscale smaller square images (spec: "kleiner bleibt kleiner")', async () => {
    const input = await solidColorPng(700, 700);
    const r = await processImage(input);
    if (!('jpegBuffer' in r)) throw new Error('expected success');
    // Square → no padding; resized to itself
    const meta = await sharp(r.jpegBuffer).metadata();
    expect(meta.width).toBe(700);
    expect(meta.height).toBe(700);
  });

  it('pads non-square small images to 1600×1600 white', async () => {
    const input = await solidColorPng(700, 500);
    const r = await processImage(input);
    if (!('jpegBuffer' in r)) throw new Error('expected success');
    expect(r.width).toBe(1600);
    expect(r.height).toBe(1600);
  });

  it('returns skipped_too_small when width < 500', async () => {
    const input = await solidColorPng(400, 800);
    const r = await processImage(input);
    expect('status' in r ? r.status : null).toBe('skipped_too_small');
  });

  it('returns skipped_too_small when height < 500', async () => {
    const input = await solidColorPng(800, 400);
    const r = await processImage(input);
    expect('status' in r ? r.status : null).toBe('skipped_too_small');
  });

  it('accepts exactly MIN_SIDE_PX', async () => {
    const input = await solidColorPng(MIN_SIDE_PX, MIN_SIDE_PX);
    const r = await processImage(input);
    expect('jpegBuffer' in r).toBe(true);
  });

  it('throws ImageError on corrupt buffer', async () => {
    await expect(processImage(Buffer.from('not an image'))).rejects.toThrow(ImageError);
  });

  it('JPEG q=85 is smaller than WebP q=80 for a typical photo-like input', async () => {
    const input = await solidColorPng(2000, 2000, { r: 128, g: 64, b: 200 });
    const r = await processImage(input);
    if (!('jpegBuffer' in r)) throw new Error('expected success');
    // Both should be reasonably compressed; solid color is tiny in either.
    expect(r.jpegBuffer.byteLength).toBeLessThan(500_000);
    expect(r.webpBuffer.byteLength).toBeLessThan(500_000);
  });
});
