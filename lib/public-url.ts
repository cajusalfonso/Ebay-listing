/**
 * Build an absolute URL pointing at the public origin of the app.
 *
 * Behind Railway (and most reverse proxies), `req.url` reflects the internal
 * bind address (`http://0.0.0.0:8080/...`), which is useless as a redirect
 * target because the browser can't reach it.
 *
 * Priority: we trust the `X-Forwarded-Host` header FIRST because it always
 * reflects the real request origin. `AUTH_URL` is used only as a fallback for
 * environments without a reverse proxy (e.g. local dev without a tunnel). This
 * ordering protects against stale/placeholder AUTH_URL values that would
 * otherwise break every redirect silently.
 */
export function publicUrl(req: Request, path: string): URL {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const forwardedProto = req.headers.get('x-forwarded-proto') ?? 'https';
  if (forwardedHost) {
    return new URL(path, `${forwardedProto}://${forwardedHost}`);
  }

  const authUrl = process.env.AUTH_URL;
  if (authUrl && authUrl.length > 0 && !authUrl.includes('placeholder')) {
    return new URL(path, authUrl);
  }

  return new URL(path, req.url);
}
