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
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico';

  if (isPublic) return NextResponse.next();

  if (!req.auth) {
    const loginUrl = new URL('/auth/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Match everything except static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
