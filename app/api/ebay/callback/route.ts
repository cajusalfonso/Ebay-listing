import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';
import { getEncryptionKey } from '../../../../lib/encryption-key';
import { publicUrl } from '../../../../lib/public-url';
import { buildUserOauthClient } from '../../../../lib/user-clients';
import { createUserTokenStore } from '../../../../src/modules/ebay/userTokenStore';
import { STATE_COOKIE, ENV_COOKIE, verifyState } from '../connect/route';

/**
 * OAuth 2.0 callback from eBay.
 *   - Verifies the caller still has an active session
 *   - Verifies the `state` param matches what we set on the connect cookie
 *   - Exchanges the one-shot `code` for access+refresh tokens
 *   - AES-256-GCM encrypts both tokens and upserts into `user_ebay_tokens`
 *
 * Every error path clears the state/env cookies so we don't leak tokens
 * from a partial / interrupted flow.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const settingsUrl = publicUrl(req, '/settings');

  const session = await auth();
  if (!session?.user?.id) {
    settingsUrl.searchParams.set('error', 'session_expired');
    return NextResponse.redirect(settingsUrl);
  }
  const userId = Number.parseInt(session.user.id, 10);

  const ebayError = url.searchParams.get('error');
  if (ebayError) {
    settingsUrl.searchParams.set('error', `ebay_${ebayError}`);
    return NextResponse.redirect(settingsUrl);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    settingsUrl.searchParams.set('error', 'missing_code_or_state');
    return NextResponse.redirect(settingsUrl);
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const ebayEnvRaw = cookieStore.get(ENV_COOKIE)?.value;
  const ebayEnv: 'sandbox' | 'production' =
    ebayEnvRaw === 'production' ? 'production' : 'sandbox';

  if (!expectedState || !verifyState(state, expectedState)) {
    settingsUrl.searchParams.set('error', 'csrf_state_mismatch');
    return NextResponse.redirect(settingsUrl);
  }

  const oauth = await buildUserOauthClient(userId, ebayEnv);

  try {
    const tokens = await oauth.exchangeCodeForTokens(code);
    const store = createUserTokenStore(db, userId, getEncryptionKey());
    await store.save(ebayEnv, tokens);
  } catch {
    settingsUrl.searchParams.set('error', 'token_exchange_failed');
    return NextResponse.redirect(settingsUrl);
  }

  settingsUrl.searchParams.set('connected', ebayEnv);
  const response = NextResponse.redirect(settingsUrl);
  // Clean up flow cookies.
  response.cookies.delete(STATE_COOKIE);
  response.cookies.delete(ENV_COOKIE);
  return response;
}
