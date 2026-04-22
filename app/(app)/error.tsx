'use client';

import { useEffect } from 'react';

export default function AppGroupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[(app)/error.tsx]', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-red-700">Anwendungsfehler</h1>
      <p className="text-sm text-gray-600">
        Im App-Layout oder einer Unterseite ist eine Exception aufgetreten. Details:
      </p>
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm">
        <div className="mb-2">
          <span className="font-semibold">Message:</span>
          <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-xs text-red-900">
            {error.message || '(leer)'}
          </pre>
        </div>
        {error.digest ? (
          <div className="mb-2">
            <span className="font-semibold">Digest:</span>{' '}
            <code className="font-mono text-xs">{error.digest}</code>
          </div>
        ) : null}
        {error.stack ? (
          <div>
            <span className="font-semibold">Stack:</span>
            <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-white p-2 font-mono text-[10px] text-gray-800">
              {error.stack}
            </pre>
          </div>
        ) : null}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => reset()} className="btn-primary">
          Erneut versuchen
        </button>
        <a href="/auth/login" className="btn-secondary">
          Neu einloggen
        </a>
      </div>
    </div>
  );
}
