"use client";

import { ROLE_LABELS, useUserNome, useUserRole } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";

/** Barra superior do painel (desktop) — a Sidebar já cobre o header mobile. */
export function Navbar() {
  const userRole = useUserRole();
  const nome = useUserNome();
  const label = ROLE_LABELS[userRole];

  return (
    <header className="hidden items-center justify-end gap-4 border-b bg-background px-6 py-3 lg:flex">
      <ThemeToggle />
      <div className="flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-sm font-semibold text-white"
          aria-hidden
        >
          {(nome ?? label).charAt(0).toUpperCase()}
        </span>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-medium text-foreground">{nome ?? label}</span>
          {nome && <span className="text-xs text-muted-foreground">{label}</span>}
        </div>
      </div>
    </header>
  );
}
