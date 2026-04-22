import { NextResponse } from 'next/server';
import { auth } from './lib/auth';

/**
 * Middleware gate for protected routes. Everything under `/dashboard`,
 * `/settings`, `/listings` requires an authenticated session.
 * Public routes: `/auth/*`, `/api/auth/*`, `/`.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/' ||
    pathname === '/privacy' ||
    pathname === '/terms' ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico';

  if (isPublic) return NextResponse.next();

  if (!req.auth) {
    // Prefer X-Forwarded-Host (always reflects the real origin behind a
    // reverse proxy like Railway). Fall back to AUTH_URL only when no proxy
    // header is present and AUTH_URL is not a placeholder value.
    const forwardedHost = req.headers.get('x-forwarded-host');
    const forwardedProto = req.headers.get('x-forwarded-proto') ?? 'https';
    const authUrl = process.env.AUTH_URL;
    const base = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : authUrl && authUrl.length > 0 && !authUrl.includes('placeholder')
        ? authUrl
        : req.url;
    const loginUrl = new URL('/auth/login', base);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Match everything except static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
