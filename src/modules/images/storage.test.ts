import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createImageStorage } from './storage';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ebay-vol-img-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('ImageStorage', () => {
  it('writes original to {root}/{ean}/original/{NN}.{ext}', async () => {
    const storage = createImageStorage({ rootPath: root });
    const path = await storage.saveOriginal('4006381333115', 0, {
      buffer: Buffer.from('raw bytes'),
      contentType: 'image/jpeg',
      originalExtension: 'jpg',
      byteLength: 9,
    });
    expect(path).toMatch(/4006381333115\/original\/00\.jpg$/);
    expect(readFileSync(path).toString()).toBe('raw bytes');
  });

  it('pads the index to 2 digits (01, 02, ... 11)', async () => {
    const storage = createImageStorage({ rootPath: root });
    const p = await storage.saveOriginal('ean', 1, {
      buffer: Buffer.from('b'),
      contentType: 'image/png',
      originalExtension: 'png',
      byteLength: 1,
    });
    expect(p.endsWith('01.png')).toBe(true);
    const p11 = await storage.saveOriginal('ean', 11, {
      buffer: Buffer.from('b'),
      contentType: 'image/png',
      originalExtension: 'png',
      byteLength: 1,
    });
    expect(p11.endsWith('11.png')).toBe(true);
  });

  it('writes both processed .jpg and .webp for an index', async () => {
    const storage = createImageStorage({ rootPath: root });
    const paths = await storage.saveProcessed('ean-x', 2, {
      jpegBuffer: Buffer.from('fake-jpeg'),
      webpBuffer: Buffer.from('fake-webp'),
      width: 1600,
      height: 1600,
    });
    expect(paths.processedJpegPath.endsWith('/ean-x/processed/02.jpg')).toBe(true);
    expect(paths.processedWebpPath.endsWith('/ean-x/processed/02.webp')).toBe(true);
    expect(readFileSync(paths.processedJpegPath).toString()).toBe('fake-jpeg');
    expect(readFileSync(paths.processedWebpPath).toString()).toBe('fake-webp');
  });
});
