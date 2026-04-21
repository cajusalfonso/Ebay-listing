import { request } from 'undici';
import type { z } from 'zod';
import {
  EBAY_BASE_URLS,
  EBAY_MARKETPLACE_ID,
  HTTP_TIMEOUTS,
  RETRY_CONFIG,
  type EbayEnvironment,
} from '../../config/constants';
import { withRetry } from '../../lib/retry';
import { EbayApiError } from './errors';

export interface EbayHttpClientConfig {
  readonly environment: EbayEnvironment;
  /**
   * Returns a currently-valid user or application access token.
   * Called on every request so a just-refreshed token lands on the wire immediately.
   */
  readonly getAccessToken: () => Promise<string>;
  /** Override default `X-EBAY-C-MARKETPLACE-ID` (defaults to EBAY_DE). */
  readonly marketplaceId?: string;
  /** Test-only: skip real `setTimeout` waits during retry. */
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface EbayRequestOptions {
  readonly query?: Readonly<Record<string, string | number | undefined>>;
  readonly marketplaceId?: string;
  readonly extraHeaders?: Readonly<Record<string, string>>;
}

export interface EbayHttpClient {
  get<T>(path: string, schema: z.ZodType<T>, options?: EbayRequestOptions): Promise<T>;
  post<T>(
    path: string,
    body: unknown,
    schema: z.ZodType<T>,
    options?: EbayRequestOptions
  ): Promise<T>;
  put<T>(
    path: string,
    body: unknown,
    schema: z.ZodType<T>,
    options?: EbayRequestOptions
  ): Promise<T>;
}

function shouldRetry(error: unknown): boolean {
  if (!(error instanceof EbayApiError)) return false;
  const status = error.context.statusCode;
  if (typeof status !== 'number') return false;
  return status === 429 || (status >= 500 && status < 600);
}

/**
 * Authenticated eBay HTTP client. Every call:
 *  - Prepends `config.environment`'s base URL (sandbox / production).
 *  - Attaches `Authorization: Bearer <token>` from `getAccessToken()`.
 *  - Sets `X-EBAY-C-MARKETPLACE-ID` (EBAY_DE by default).
 *  - Validates 2xx bodies via the provided Zod schema.
 *  - Retries on 429 / 5xx with exponential backoff (3 attempts, 1s/2s/4s delays).
 *  - Does NOT retry 4xx or schema mismatches — those are client/server-contract errors.
 */
export function createEbayHttpClient(config: EbayHttpClientConfig): EbayHttpClient {
  const baseUrl = EBAY_BASE_URLS[config.environment].api;
  const defaultMarketplaceId = config.marketplaceId ?? EBAY_MARKETPLACE_ID;

  async function doRequest<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    schema: z.ZodType<T>,
    body: unknown,
    options: EbayRequestOptions
  ): Promise<T> {
    const url = new URL(`${baseUrl}${path}`);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const accessToken = await config.getAccessToken();
    const headers: Record<string, string> = {
      authorization: `Bearer ${accessToken}`,
      'x-ebay-c-marketplace-id': options.marketplaceId ?? defaultMarketplaceId,
      accept: 'application/json',
      ...options.extraHeaders,
    };
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }

    return withRetry(
      async () => {
        const { statusCode, body: responseBody } = await request(url.toString(), {
          method,
          headers,
          bodyTimeout: HTTP_TIMEOUTS.ebayApi,
          headersTimeout: HTTP_TIMEOUTS.ebayApi,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const rawText = await responseBody.text();
        let json: unknown;
        try {
          json = rawText.length > 0 ? (JSON.parse(rawText) as unknown) : undefined;
        } catch {
          throw new EbayApiError(`Non-JSON response from ${method} ${path}`, {
            path,
            method,
            statusCode,
            rawText,
          });
        }

        if (statusCode < 200 || statusCode >= 300) {
          throw new EbayApiError(`eBay API ${statusCode} for ${method} ${path}`, {
            path,
            method,
            statusCode,
            response: json,
          });
        }

        const parsed = schema.safeParse(json);
        if (!parsed.success) {
          throw new EbayApiError(`Response schema mismatch for ${method} ${path}`, {
            path,
            method,
            statusCode,
            issues: parsed.error.issues,
          });
        }
        return parsed.data;
      },
      {
        maxAttempts: RETRY_CONFIG.maxAttempts,
        initialDelayMs: RETRY_CONFIG.initialDelayMs,
        backoffMultiplier: RETRY_CONFIG.backoffMultiplier,
        shouldRetry,
        ...(config.sleep ? { sleep: config.sleep } : {}),
      }
    );
  }

  return {
    get: (path, schema, options = {}) => doRequest('GET', path, schema, undefined, options),
    post: (path, body, schema, options = {}) => doRequest('POST', path, schema, body, options),
    put: (path, body, schema, options = {}) => doRequest('PUT', path, schema, body, options),
  };
}
