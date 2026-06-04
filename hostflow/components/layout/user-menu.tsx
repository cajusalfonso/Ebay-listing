"use client";

import Link from "next/link";
import { CreditCard, LogOut, Settings, User } from "lucide-react";

import { logout } from "@/lib/auth/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ROLE_LABELS, type UserRole } from "@/lib/types";

function initials(name: string, fallback: string): string {
  const source = name.trim() || fallback;
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserMenu({
  fullName,
  email,
  role,
}: {
  fullName: string;
  email: string | null;
  role: UserRole;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar>
          <AvatarFallback>{initials(fullName, email ?? "?")}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="truncate font-medium">{fullName || "Profil"}</span>
            {email && (
              <span className="truncate text-xs font-normal text-muted-foreground">
                {email}
              </span>
            )}
            <span className="mt-1 text-xs font-normal text-muted-foreground">
              Rolle: {ROLE_LABELS[role]}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <User className="h-4 w-4" /> Mein Profil
        </DropdownMenuItem>
        {role === "owner" && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/abo">
                <CreditCard className="h-4 w-4" /> Abo & Abrechnung
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/einstellungen">
                <Settings className="h-4 w-4" /> Einstellungen
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <form action={logout}>
          <button type="submit" className="w-full">
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" /> Abmelden
            </DropdownMenuItem>
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
