import { spawn } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { platform } from 'node:os';
import { URL } from 'node:url';
import { defineCommand, runMain } from 'citty';
import { loadEnv } from '../config/env';
import { createDbClient } from '../db/client';
import { newCorrelationId, withCorrelation } from '../lib/correlation';
import { parseEncryptionKey } from '../lib/encryption';
import { createLogger } from '../lib/logger';
import { createEbayOAuthClient } from '../modules/ebay/auth';
import { EbayAuthError } from '../modules/ebay/errors';
import { createDbTokenStore } from '../modules/ebay/tokenStore';

const log = createLogger({ pretty: true });

interface CallbackResult {
  readonly code: string;
  readonly state: string | undefined;
}

/**
 * Spin up a one-shot HTTP listener to catch the OAuth redirect from eBay.
 * Resolves on the first successful callback, rejects on error or timeout.
 */
function awaitOauthCallback(
  port: number,
  path: string,
  timeoutMs: number
): Promise<CallbackResult> {
  return new Promise((resolve, reject) => {
    const handler = (req: IncomingMessage, res: ServerResponse): void => {
      const requestUrl = new URL(req.url ?? '/', `http://localhost:${String(port)}`);
      if (requestUrl.pathname !== path) {
        res.writeHead(404);
        res.end();
        return;
      }
      const errorCode = requestUrl.searchParams.get('error');
      if (errorCode) {
        const errorDescription = requestUrl.searchParams.get('error_description') ?? '';
        res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<h1>eBay returned an error</h1><pre>${errorCode}: ${errorDescription}</pre>`);
        server.close();
        reject(new EbayAuthError(`OAuth callback error: ${errorCode} — ${errorDescription}`));
        return;
      }
      const code = requestUrl.searchParams.get('code');
      if (!code) {
        res.writeHead(400, { 'content-type': 'text/plain' });
        res.end('Missing "code" param.');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="utf-8"><title>eBay Auth OK</title></head>
        <body style="font-family: system-ui; padding: 2rem; max-width: 40rem;">
          <h1>✓ eBay authorization received</h1>
          <p>You can close this tab. The CLI is now exchanging the authorization code for tokens.</p>
        </body>
        </html>
      `);
      server.close();
      resolve({ code, state: requestUrl.searchParams.get('state') ?? undefined });
    };

    const server = createServer(handler);
    const timeoutHandle = setTimeout(() => {
      server.close();
      reject(new EbayAuthError(`OAuth callback timed out after ${String(timeoutMs)}ms`));
    }, timeoutMs);
    server.on('close', () => {
      clearTimeout(timeoutHandle);
    });
    server.listen(port, '127.0.0.1', () => {
      log.info(`Waiting for eBay OAuth callback on http://localhost:${String(port)}${path}`);
    });
    server.on('error', reject);
  });
}

function openInBrowser(url: string): void {
  const cmd = platform() === 'darwin' ? 'open' : platform() === 'win32' ? 'start' : 'xdg-open';
  try {
    const child = spawn(cmd, [url], { detached: true, stdio: 'ignore' });
    child.unref();
    child.on('error', () => {
      log.warn('Could not auto-open browser. Paste the URL above manually.');
    });
  } catch {
    log.warn('Could not auto-open browser. Paste the URL above manually.');
  }
}

const command = defineCommand({
  meta: {
    name: 'setup:ebay-auth',
    description:
      'One-time interactive OAuth flow: opens browser, captures callback, stores encrypted tokens in DB.',
  },
  args: {
    port: {
      type: 'string',
      description:
        'Local port for the callback listener (must match RuName URL in eBay Dev Dashboard)',
      default: '8080',
    },
    path: {
      type: 'string',
      description: 'Local path for the callback listener',
      default: '/callback',
    },
    timeoutSeconds: {
      type: 'string',
      description: 'Max seconds to wait for the callback',
      default: '300',
    },
    noOpen: {
      type: 'boolean',
      description: 'Do not auto-open browser; just print the URL',
      default: false,
    },
  },
  async run({ args }) {
    await withCorrelation(newCorrelationId(), async () => {
      const env = loadEnv();
      const port = Number.parseInt(args.port, 10);
      const timeoutMs = Number.parseInt(args.timeoutSeconds, 10) * 1_000;

      log.info({ environment: env.EBAY_ENV }, 'Starting eBay OAuth setup');

      const oauthClient = createEbayOAuthClient({
        environment: env.EBAY_ENV,
        appId: env.EBAY_APP_ID,
        certId: env.EBAY_CERT_ID,
        redirectUriName: env.EBAY_REDIRECT_URI_NAME,
      });
      const state = newCorrelationId();
      const authorizeUrl = oauthClient.buildAuthorizeUrl(state);

      // eslint-disable-next-line no-console -- user-facing CLI output, stdout not log
      console.log(`\nOpen this URL in your browser to grant consent:\n\n  ${authorizeUrl}\n`);
      if (!args.noOpen) {
        openInBrowser(authorizeUrl);
      }

      const callback = await awaitOauthCallback(port, args.path, timeoutMs);
      if (callback.state !== state) {
        throw new EbayAuthError('State mismatch — possible CSRF, aborting', {
          expected: state,
          received: callback.state,
        });
      }

      log.info('Callback received, exchanging code for tokens…');
      const tokens = await oauthClient.exchangeCodeForTokens(callback.code);

      const dbClient = createDbClient(env.DATABASE_URL);
      try {
        const store = createDbTokenStore(dbClient.db, parseEncryptionKey(env.TOKEN_ENCRYPTION_KEY));
        await store.save(env.EBAY_ENV, tokens);
      } finally {
        await dbClient.close();
      }

      log.info(
        {
          environment: env.EBAY_ENV,
          accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
          refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString(),
        },
        '✓ eBay tokens stored (AES-256-GCM encrypted) in DB'
      );
    });
  },
});

await runMain(command);
