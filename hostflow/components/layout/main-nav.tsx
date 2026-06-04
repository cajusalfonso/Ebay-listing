"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ClipboardList,
  Clock,
  Euro,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { isStaffRole, type UserRole } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  staffOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/aufgaben", label: "Aufgaben", icon: ClipboardList },
  { href: "/zeiten", label: "Zeiten", icon: Clock },
  { href: "/objekte", label: "Objekte", icon: Building2, staffOnly: true },
  { href: "/kosten", label: "Kosten", icon: Euro, staffOnly: true },
  { href: "/team", label: "Team", icon: Users, staffOnly: true },
];

export function MainNav({
  role,
  className,
}: {
  role: UserRole;
  className?: string;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter(
    (item) => !item.staffOnly || isStaffRole(role),
  );

  return (
    <nav className={cn("flex gap-1", className)}>
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
