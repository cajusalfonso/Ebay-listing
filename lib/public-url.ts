/**
 * Build an absolute URL pointing at the public origin of the app.
 *
 * Behind Railway (and most reverse proxies), `req.url` reflects the internal
 * bind address (`http://0.0.0.0:8080/...`), which is useless as a redirect
 * target because the browser can't reach it. We prefer, in order:
 *   1. `AUTH_URL` env var (already configured for NextAuth)
 *   2. `X-Forwarded-Proto` + `X-Forwarded-Host` request headers
 *   3. `req.url` as a last-resort fallback
 */
export function publicUrl(req: Request, path: string): URL {
  const authUrl = process.env.AUTH_URL;
  if (authUrl && authUrl.length > 0) {
    return new URL(path, authUrl);
  }

  const forwardedHost = req.headers.get('x-forwarded-host');
  const forwardedProto = req.headers.get('x-forwarded-proto') ?? 'https';
  if (forwardedHost) {
    return new URL(path, `${forwardedProto}://${forwardedHost}`);
  }

  return new URL(path, req.url);
}
