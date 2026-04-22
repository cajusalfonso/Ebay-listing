/**
 * eBay API base URLs per environment.
 * Sandbox is used for MVP development; Production requires the double opt-in
 * (`EBAY_ENV=production` + `--env=production --yes-really` CLI flag).
 */
export const EBAY_BASE_URLS = {
  sandbox: {
    api: 'https://api.sandbox.ebay.com',
    auth: 'https://auth.sandbox.ebay.com',
  },
  production: {
    api: 'https://api.ebay.com',
    auth: 'https://auth.ebay.com',
  },
} as const;

export type EbayEnvironment = keyof typeof EBAY_BASE_URLS;

/** eBay.de marketplace ID required on every Browse/Inventory call. */
export const EBAY_MARKETPLACE_ID = 'EBAY_DE';

/** OAuth scopes needed for MVP flows. Restricted scopes (commerce.catalog,
 *  buy.item.feed) are intentionally omitted — they require per-account
 *  partner onboarding with eBay and cause temporarily_unavailable 500 on
 *  /oauth2/authorize when the app is not whitelisted. */
export const EBAY_OAUTH_SCOPES: readonly string[] = [
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
] as const;

/** HTTP timeouts in milliseconds. */
export const HTTP_TIMEOUTS = {
  default: 30_000,
  imageDownload: 60_000,
  ebayApi: 30_000,
  ebayEpsUpload: 120_000,
} as const;

/** Retry policy for 429/5xx responses. Uses exponential backoff. */
export const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 1_000,
  backoffMultiplier: 2,
} as const;

/** Refresh the access token when less than this much lifetime remains. */
export const ACCESS_TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1_000;
