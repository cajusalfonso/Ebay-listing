import { AppError } from '../../lib/errors';

/**
 * Thrown for any eBay HTTP failure (4xx/5xx after retries exhausted) or
 * schema mismatch on a response body. `context` carries `statusCode`,
 * `path`, `ebayErrorId`, and the raw response when available.
 */
export class EbayApiError extends AppError {
  public override readonly code = 'EBAY_API_ERROR';
}

/**
 * Thrown specifically for OAuth/token-related failures: token exchange
 * rejection, refresh-token expired, no tokens stored yet. Callers can
 * distinguish from generic EbayApiError to decide whether to prompt
 * re-auth vs. retry vs. fail-fast.
 */
export class EbayAuthError extends AppError {
  public override readonly code = 'EBAY_AUTH_ERROR';
}
