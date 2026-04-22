'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global-error.tsx]', error);
  }, [error]);

  return (
    <html lang="de">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{ color: '#b91c1c', fontSize: '24px', marginBottom: '12px' }}>
          Globaler Anwendungsfehler
        </h1>
        <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '16px' }}>
          Die App hat einen Fehler geworfen, der nicht abgefangen wurde. Details unten.
        </p>
        <div style={{ border: '1px solid #fecaca', background: '#fef2f2', padding: '16px', borderRadius: '6px', fontSize: '13px' }}>
          <div style={{ marginBottom: '8px' }}>
            <strong>Message:</strong>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '12px', marginTop: '4px', color: '#7f1d1d' }}>
              {error.message || '(leer)'}
            </pre>
          </div>
          {error.digest ? (
            <div style={{ marginBottom: '8px' }}>
              <strong>Digest:</strong>{' '}
              <code style={{ fontFamily: 'monospace', fontSize: '12px' }}>{error.digest}</code>
            </div>
          ) : null}
          {error.stack ? (
            <div>
              <strong>Stack:</strong>
              <pre style={{ maxHeight: '400px', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: 'white', padding: '8px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '10px', color: '#1f2937', marginTop: '4px' }}>
                {error.stack}
              </pre>
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button type="button" onClick={() => reset()} style={{ padding: '8px 16px', background: '#0f766e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            Erneut versuchen
          </button>
          <a href="/auth/login" style={{ padding: '8px 16px', background: '#e5e7eb', color: '#111827', borderRadius: '6px', textDecoration: 'none' }}>
            Neu einloggen
          </a>
        </div>
      </body>
    </html>
  );
}
