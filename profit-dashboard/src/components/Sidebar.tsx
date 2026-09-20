"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_ITEMS = [
  { href: "/uebersicht", label: "Übersicht", icon: "📊" },
  { href: "/bestellungen", label: "Bestellungen", icon: "🛒" },
  { href: "/kosten", label: "Kosten", icon: "💶" },
  { href: "/kontoauszug", label: "Kontoauszug", icon: "🏦" },
  { href: "/einstellungen", label: "Einstellungen", icon: "⚙️" },
];

export function Sidebar({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800 lg:hidden">
        <span className="font-bold text-brand-dark dark:text-brand">Lumox.store</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            className="btn-secondary px-3 py-1"
            onClick={() => setOpen((v) => !v)}
          >
            Menü
          </button>
        </div>
      </div>

      <aside
        className={`${
          open ? "block" : "hidden"
        } w-full border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 lg:block lg:w-64 lg:min-h-screen lg:border-b-0 lg:border-r`}
      >
        <div className="hidden items-center justify-between px-6 py-6 lg:flex">
          <div>
            <h1 className="text-lg font-bold text-brand-dark dark:text-brand">
              Lumox.store
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gewinn-Übersicht
            </p>
          </div>
          <ThemeToggle />
        </div>

        <nav className="space-y-1 px-3 py-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-brand/10 text-brand-dark dark:bg-brand/20 dark:text-brand"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 px-3 py-3 dark:border-slate-700">
          {userEmail && (
            <p className="mb-2 truncate px-3 text-xs text-slate-400 dark:text-slate-500">
              {userEmail}
            </p>
          )}
          <button onClick={handleLogout} className="btn-secondary w-full">
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
