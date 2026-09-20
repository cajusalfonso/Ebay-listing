import { ThemeToggle } from "@/components/ThemeToggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-brand-dark dark:text-brand">
            Lumox.store
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gewinn-Übersicht
          </p>
        </div>
        <div className="card">{children}</div>
      </div>
    </div>
  );
}
