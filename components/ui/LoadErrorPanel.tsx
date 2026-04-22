interface Props {
  title: string;
  where: string;
  message: string;
  stack?: string | undefined;
}

/**
 * Inline error display for page loaders. Rendered as props (not thrown),
 * so the message survives Next.js's production error-stripping.
 */
export function LoadErrorPanel({ title, where, message, stack }: Props) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-red-700">{title}</h1>
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm">
        <div className="mb-2">
          <span className="font-semibold">Stelle:</span>{' '}
          <code className="font-mono text-xs">{where}</code>
        </div>
        <div className="mb-2">
          <span className="font-semibold">Message:</span>
          <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-xs text-red-900">
            {message}
          </pre>
        </div>
        {stack ? (
          <div>
            <span className="font-semibold">Stack:</span>
            <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-white p-2 font-mono text-[10px] text-gray-800">
              {stack}
            </pre>
          </div>
        ) : null}
      </div>
      <div className="flex gap-2">
        <a href="/dashboard" className="btn-primary">
          Zurück zum Dashboard
        </a>
        <a href="/auth/login" className="btn-secondary">
          Neu einloggen
        </a>
      </div>
    </div>
  );
}
