import { randomUUID, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '../../../../lib/auth';
import { buildUserOauthClient, MissingCredentialsError } from '../../../../lib/user-clients';

const STATE_COOKIE_NAME = 'ebay_oauth_state';
const ENV_COOKIE_NAME = 'ebay_oauth_env';

/**
 * Kick off the eBay OAuth flow for the logged-in user.
 * Steps:
 *   1. Require an authenticated session
 *   2. Load the user's App ID / Cert ID / RuName from encrypted storage
 *   3. Generate a random state, store it (HttpOnly) in a cookie, include in URL
 *   4. Redirect to eBay's consent page
 *
 * After consent, eBay calls the URL configured on the user's RuName, which
 * must point to `${APP_BASE_URL}/api/ebay/callback`.
 */
export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/auth/login', req.url));
  }
  const userId = Number.parseInt(session.user.id, 10);

  const url = new URL(req.url);
  const envParam = url.searchParams.get('env');
  const ebayEnv: 'sandbox' | 'production' = envParam === 'production' ? 'production' : 'sandbox';

  let oauth;
  try {
    oauth = await buildUserOauthClient(userId, ebayEnv);
  } catch (error) {
    if (error instanceof MissingCredentialsError) {
      const redirect = new URL('/settings', req.url);
      redirect.searchParams.set('error', 'missing_credentials');
      return NextResponse.redirect(redirect);
    }
    throw error;
  }

  const state = randomUUID();
  const authorizeUrl = oauth.buildAuthorizeUrl(state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60, // 10 minutes to complete consent
    path: '/',
  });
  response.cookies.set(ENV_COOKIE_NAME, ebayEnv, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60,
    path: '/',
  });
  return response;
}

/** Internal helper used by the callback route to verify state without
 *  importing node:crypto in multiple places. Exported so test helpers can call it. */
export function verifyState(received: string, expected: string): boolean {
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

// Typescript-satisfier — force cookies() import to not be pruned when
// the callback imports constants from this file.
export const STATE_COOKIE = STATE_COOKIE_NAME;
export const ENV_COOKIE = ENV_COOKIE_NAME;

// Re-exported for the callback
export { cookies };
