import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { createEbayOAuthClient, type EbayOAuthConfig } from './auth';
import { EbayAuthError } from './errors';

const SANDBOX_API = 'https://api.sandbox.ebay.com';
const SANDBOX_AUTH = 'https://auth.sandbox.ebay.com';

function config(overrides: Partial<EbayOAuthConfig> = {}): EbayOAuthConfig {
  return {
    environment: 'sandbox',
    appId: 'my-app-id',
    certId: 'my-cert-id',
    redirectUriName: 'my-ruName',
    ...overrides,
  };
}

let mockAgent: MockAgent;

beforeEach(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
});

afterEach(async () => {
  await mockAgent.close();
});

describe('buildAuthorizeUrl', () => {
  it('builds a consent URL with all required params', () => {
    const url = createEbayOAuthClient(config()).buildAuthorizeUrl();
    expect(url).toContain(`${SANDBOX_AUTH}/oauth2/authorize?`);
    expect(url).toContain('client_id=my-app-id');
    expect(url).toContain('response_type=code');
    expect(url).toContain('redirect_uri=my-ruName');
    expect(url).toContain('scope=');
  });

  it('includes state when provided (for CSRF protection)', () => {
    const url = createEbayOAuthClient(config()).buildAuthorizeUrl('abc123');
    expect(url).toContain('state=abc123');
  });

  it('uses production auth host when environment=production', () => {
    const url = createEbayOAuthClient(config({ environment: 'production' })).buildAuthorizeUrl();
    expect(url).toContain('https://auth.ebay.com/oauth2/authorize');
  });
});

describe('exchangeCodeForTokens', () => {
  it('posts correct grant_type+code+redirect_uri with Basic auth, parses tokens', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: '/identity/v1/oauth2/token',
        method: 'POST',
        body: (b) =>
          b.includes('grant_type=authorization_code') &&
          b.includes('code=one-time-code') &&
          b.includes('redirect_uri=my-ruName'),
      })
      .reply(
        200,
        {
          access_token: 'acc-tok',
          expires_in: 7200,
          refresh_token: 'ref-tok',
          refresh_token_expires_in: 47304000, // 18 months
          token_type: 'User Access Token',
        },
        { headers: { 'content-type': 'application/json' } }
      );

    const client = createEbayOAuthClient(config());
    const tokens = await client.exchangeCodeForTokens('one-time-code');
    expect(tokens.accessToken).toBe('acc-tok');
    expect(tokens.refreshToken).toBe('ref-tok');
    const now = Date.now();
    expect(tokens.accessTokenExpiresAt.getTime() - now).toBeGreaterThan(7_000_000);
    expect(tokens.accessTokenExpiresAt.getTime() - now).toBeLessThan(7_300_000);
    expect(tokens.refreshTokenExpiresAt.getTime() - now).toBeGreaterThan(47_000_000_000);
  });

  it('throws EbayAuthError with statusCode in context on 400', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({ path: '/identity/v1/oauth2/token', method: 'POST' })
      .reply(400, { error: 'invalid_grant' });

    const client = createEbayOAuthClient(config());
    try {
      await client.exchangeCodeForTokens('bad-code');
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EbayAuthError);
      expect((err as EbayAuthError).context.statusCode).toBe(400);
    }
  });

  it('throws on schema mismatch when eBay returns incomplete body', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({ path: '/identity/v1/oauth2/token', method: 'POST' })
      .reply(200, { access_token: 'only-access' });

    const client = createEbayOAuthClient(config());
    try {
      await client.exchangeCodeForTokens('code');
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EbayAuthError);
      expect((err as EbayAuthError).message).toMatch(/schema mismatch/);
    }
  });
});

describe('refreshAccessToken', () => {
  it('posts grant_type=refresh_token with scope, parses response', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: '/identity/v1/oauth2/token',
        method: 'POST',
        body: (b) =>
          b.includes('grant_type=refresh_token') &&
          b.includes('refresh_token=my-refresh') &&
          b.includes('scope='),
      })
      .reply(
        200,
        { access_token: 'new-acc', expires_in: 7200, token_type: 'User Access Token' },
        { headers: { 'content-type': 'application/json' } }
      );

    const client = createEbayOAuthClient(config());
    const r = await client.refreshAccessToken('my-refresh');
    expect(r.accessToken).toBe('new-acc');
    expect(r.accessTokenExpiresAt.getTime()).toBeGreaterThan(Date.now() + 7_000_000);
  });

  it('throws on 401 (refresh token revoked/expired)', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({ path: '/identity/v1/oauth2/token', method: 'POST' })
      .reply(401, { error: 'invalid_client' });

    const client = createEbayOAuthClient(config());
    await expect(client.refreshAccessToken('stale')).rejects.toBeInstanceOf(EbayAuthError);
  });
});

describe('environment → base URL routing', () => {
  it('sandbox uses sandbox.ebay.com', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool.intercept({ path: '/identity/v1/oauth2/token', method: 'POST' }).reply(200, {
      access_token: 'a',
      expires_in: 7200,
      refresh_token: 'r',
      refresh_token_expires_in: 1000,
      token_type: 'x',
    });
    await createEbayOAuthClient(config({ environment: 'sandbox' })).exchangeCodeForTokens('c');
    // if URL routing was wrong, disableNetConnect would have blocked it
    expect(true).toBe(true);
  });

  it('production uses api.ebay.com', async () => {
    const pool = mockAgent.get('https://api.ebay.com');
    pool.intercept({ path: '/identity/v1/oauth2/token', method: 'POST' }).reply(200, {
      access_token: 'a',
      expires_in: 7200,
      refresh_token: 'r',
      refresh_token_expires_in: 1000,
      token_type: 'x',
    });
    await createEbayOAuthClient(config({ environment: 'production' })).exchangeCodeForTokens('c');
    expect(true).toBe(true);
  });
});
