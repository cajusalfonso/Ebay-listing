/**
 * Result of exchanging an authorization code: both tokens + their absolute
 * expiry times. Converted from eBay's relative `expires_in` seconds at the
 * moment the response was received.
 */
export interface EbayTokenPair {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: Date;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
}

/**
 * Result of refreshing an access token. Refresh tokens are not returned on
 * refresh — the old one keeps its original expiry (up to 18 months per eBay).
 */
export interface EbayAccessTokenRefreshed {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: Date;
}
