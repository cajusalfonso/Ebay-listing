import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import sharp from 'sharp';
import { downloadImage } from './downloader';
import { ImageError } from './errors';

const HOST = 'https://img.example.com';
let mockAgent: MockAgent;

beforeEach(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
});

afterEach(async () => {
  await mockAgent.close();
});

async function tinyPng(): Promise<Buffer> {
  return sharp({
    create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
}

describe('downloadImage', () => {
  it('fetches a PNG and reports the correct MIME + extension', async () => {
    const png = await tinyPng();
    const pool = mockAgent.get(HOST);
    pool
      .intercept({ path: '/a.png' })
      .reply(200, png, { headers: { 'content-type': 'image/png' } });
    const r = await downloadImage(`${HOST}/a.png`);
    expect(r.contentType).toBe('image/png');
    expect(r.originalExtension).toBe('png');
    expect(r.buffer.byteLength).toBe(png.byteLength);
  });

  it('accepts image/jpeg', async () => {
    const pool = mockAgent.get(HOST);
    pool
      .intercept({ path: '/a.jpg' })
      .reply(200, Buffer.from('fake'), { headers: { 'content-type': 'image/jpeg' } });
    const r = await downloadImage(`${HOST}/a.jpg`);
    expect(r.originalExtension).toBe('jpg');
  });

  it('accepts image/webp', async () => {
    const pool = mockAgent.get(HOST);
    pool
      .intercept({ path: '/a.webp' })
      .reply(200, Buffer.from('fake'), { headers: { 'content-type': 'image/webp' } });
    const r = await downloadImage(`${HOST}/a.webp`);
    expect(r.originalExtension).toBe('webp');
  });

  it('handles content-type with charset suffix', async () => {
    const pool = mockAgent.get(HOST);
    pool.intercept({ path: '/a.png' }).reply(200, Buffer.from('fake'), {
      headers: { 'content-type': 'image/png; charset=binary' },
    });
    const r = await downloadImage(`${HOST}/a.png`);
    expect(r.contentType).toBe('image/png');
  });

  it('throws ImageError on 404', async () => {
    const pool = mockAgent.get(HOST);
    pool.intercept({ path: '/404.png' }).reply(404, '');
    await expect(downloadImage(`${HOST}/404.png`)).rejects.toThrow(ImageError);
  });

  it('throws ImageError on unsupported MIME (e.g. SVG)', async () => {
    const pool = mockAgent.get(HOST);
    pool
      .intercept({ path: '/icon.svg' })
      .reply(200, '<svg/>', { headers: { 'content-type': 'image/svg+xml' } });
    try {
      await downloadImage(`${HOST}/icon.svg`);
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ImageError);
      expect((err as ImageError).context.contentType).toBe('image/svg+xml');
    }
  });
});
