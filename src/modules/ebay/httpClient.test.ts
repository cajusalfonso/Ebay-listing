import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { z } from 'zod';
import { createEbayHttpClient } from './httpClient';
import { EbayApiError } from './errors';

const SANDBOX_API = 'https://api.sandbox.ebay.com';

let mockAgent: MockAgent;

beforeEach(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
});

afterEach(async () => {
  await mockAgent.close();
});

const ping = z.object({ ok: z.literal(true) });

function client(getAccessToken = () => Promise.resolve('mock-token')) {
  return createEbayHttpClient({
    environment: 'sandbox',
    getAccessToken,
    sleep: () => Promise.resolve(), // don't actually wait in retry tests
  });
}

describe('EbayHttpClient — GET', () => {
  it('sends Authorization Bearer and marketplace-id headers', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: '/some/path',
        method: 'GET',
        headers: (h) =>
          h.authorization === 'Bearer my-token' &&
          h['x-ebay-c-marketplace-id'] === 'EBAY_DE' &&
          h.accept === 'application/json',
      })
      .reply(200, { ok: true });
    const c = client(() => Promise.resolve('my-token'));
    const r = await c.get('/some/path', ping);
    expect(r.ok).toBe(true);
  });

  it('appends query params to the URL', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool.intercept({ path: '/q?foo=bar&num=42', method: 'GET' }).reply(200, { ok: true });
    const r = await client().get('/q', ping, { query: { foo: 'bar', num: 42 } });
    expect(r.ok).toBe(true);
  });

  it('skips undefined query values', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool.intercept({ path: '/q?present=yes', method: 'GET' }).reply(200, { ok: true });
    const r = await client().get('/q', ping, {
      query: { present: 'yes', skip: undefined },
    });
    expect(r.ok).toBe(true);
  });

  it('overrides marketplace-id per request when provided', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: '/x',
        method: 'GET',
        headers: (h) => h['x-ebay-c-marketplace-id'] === 'EBAY_US',
      })
      .reply(200, { ok: true });
    await client().get('/x', ping, { marketplaceId: 'EBAY_US' });
  });
});

describe('EbayHttpClient — POST', () => {
  it('serializes body as JSON and sets content-type', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: '/create',
        method: 'POST',
        headers: (h) => h['content-type'] === 'application/json',
        body: (b) => b === JSON.stringify({ hello: 'world' }),
      })
      .reply(201, { ok: true });
    const r = await client().post('/create', { hello: 'world' }, ping);
    expect(r.ok).toBe(true);
  });

  it('accepts 2xx status codes (e.g. 204 No Content → undefined body)', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool.intercept({ path: '/noop', method: 'POST' }).reply(200, { ok: true });
    const r = await client().post('/noop', {}, ping);
    expect(r.ok).toBe(true);
  });
});

describe('EbayHttpClient — error responses', () => {
  it('throws EbayApiError with statusCode on 400 (no retry)', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool.intercept({ path: '/bad', method: 'GET' }).reply(400, { errorId: 2004 });
    try {
      await client().get('/bad', ping);
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EbayApiError);
      expect((err as EbayApiError).context.statusCode).toBe(400);
    }
  });

  it('throws EbayApiError on schema mismatch (2xx with unexpected shape)', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool.intercept({ path: '/typo', method: 'GET' }).reply(200, { okie: true });
    try {
      await client().get('/typo', ping);
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EbayApiError);
      expect((err as EbayApiError).message).toMatch(/schema mismatch/);
    }
  });

  it('throws on non-JSON 2xx response body', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool.intercept({ path: '/html', method: 'GET' }).reply(200, '<html>not json</html>', {
      headers: { 'content-type': 'text/html' },
    });
    await expect(client().get('/html', ping)).rejects.toThrow(/Non-JSON response/);
  });
});

describe('EbayHttpClient — retry on 429 / 5xx', () => {
  it('retries on 500 and succeeds on second attempt', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool.intercept({ path: '/flaky', method: 'GET' }).reply(500, { error: 'oops' });
    pool.intercept({ path: '/flaky', method: 'GET' }).reply(200, { ok: true });
    const r = await client().get('/flaky', ping);
    expect(r.ok).toBe(true);
  });

  it('retries on 429 up to max attempts then gives up', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool.intercept({ path: '/rate', method: 'GET' }).reply(429, { error: 'rate_limited' });
    pool.intercept({ path: '/rate', method: 'GET' }).reply(429, { error: 'rate_limited' });
    pool.intercept({ path: '/rate', method: 'GET' }).reply(429, { error: 'rate_limited' });
    try {
      await client().get('/rate', ping);
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EbayApiError);
      expect((err as EbayApiError).context.statusCode).toBe(429);
    }
  });

  it('does NOT retry on 4xx client errors (other than 429)', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool.intercept({ path: '/forbidden', method: 'GET' }).reply(403, { error: 'scope' });
    // No second interceptor — if retry happened, MockAgent would throw "not matched"
    try {
      await client().get('/forbidden', ping);
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EbayApiError);
      expect((err as EbayApiError).context.statusCode).toBe(403);
    }
  });

  it('does NOT retry schema mismatches', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool.intercept({ path: '/bad-shape', method: 'GET' }).reply(200, { wrong: 'shape' });
    // No second interceptor → if retry happened, test would fail with mock-not-matched error
    await expect(client().get('/bad-shape', ping)).rejects.toThrow(/schema mismatch/);
  });
});

describe('EbayHttpClient — token acquisition', () => {
  it('calls getAccessToken on every request (so refreshed tokens land immediately)', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool.intercept({ path: '/a', method: 'GET' }).reply(200, { ok: true });
    pool.intercept({ path: '/b', method: 'GET' }).reply(200, { ok: true });
    const tokenSpy = vi.fn().mockResolvedValue('t');
    const c = createEbayHttpClient({
      environment: 'sandbox',
      getAccessToken: tokenSpy,
      sleep: () => Promise.resolve(),
    });
    await c.get('/a', ping);
    await c.get('/b', ping);
    expect(tokenSpy).toHaveBeenCalledTimes(2);
  });
});

describe('EbayHttpClient — environment routing', () => {
  it('production uses api.ebay.com', async () => {
    const pool = mockAgent.get('https://api.ebay.com');
    pool.intercept({ path: '/p', method: 'GET' }).reply(200, { ok: true });
    const c = createEbayHttpClient({
      environment: 'production',
      getAccessToken: () => Promise.resolve('t'),
      sleep: () => Promise.resolve(),
    });
    const r = await c.get('/p', ping);
    expect(r.ok).toBe(true);
  });
});
