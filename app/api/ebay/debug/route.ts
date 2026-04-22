import { NextResponse } from 'next/server';
import { auth } from '../../../../lib/auth';
import { buildUserOauthClient, MissingCredentialsError } from '../../../../lib/user-clients';
import { publicUrl } from '../../../../lib/public-url';

/**
 * Debug endpoint: returns the exact authorize URL we would send to eBay,
 * plus what we consider the public origin. Does NOT redirect. Used to
 * diagnose OAuth setup issues without triggering the real flow.
 */
export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(publicUrl(req, '/auth/login'));
  }
  const userId = Number.parseInt(session.user.id, 10);

  const url = new URL(req.url);
  const envParam = url.searchParams.get('env');
  const ebayEnv: 'sandbox' | 'production' = envParam === 'production' ? 'production' : 'sandbox';

  try {
    const oauth = await buildUserOauthClient(userId, ebayEnv);
    const authorizeUrl = oauth.buildAuthorizeUrl('debug-state');
    const parsed = new URL(authorizeUrl);
    const expectedCallback = publicUrl(req, '/api/ebay/callback').toString();

    return NextResponse.json(
      {
        env: ebayEnv,
        expectedCallbackUrl: expectedCallback,
        authorizeUrl,
        params: {
          client_id: parsed.searchParams.get('client_id'),
          response_type: parsed.searchParams.get('response_type'),
          redirect_uri: parsed.searchParams.get('redirect_uri'),
          scope: parsed.searchParams.get('scope'),
          state: parsed.searchParams.get('state'),
        },
        hint: 'The redirect_uri above is the RuName. eBay looks this up in developer.ebay.com to find the actual callback URL. If eBay shows its generic Thank You page after consent, the OAuth-mode "Your auth accepted URL" for this RuName is empty or invalid.',
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof MissingCredentialsError) {
      return NextResponse.json(
        { error: 'missing_credentials', missing: error.missing },
        { status: 400 }
      );
    }
    throw error;
  }
}
