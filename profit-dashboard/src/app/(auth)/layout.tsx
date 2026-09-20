export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-brand-dark">Lumox.store</h1>
          <p className="text-sm text-slate-500">Gewinn-Übersicht</p>
        </div>
        <div className="card">{children}</div>
      </div>
    </div>
  );
}
