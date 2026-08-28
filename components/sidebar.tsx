"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, Home, LayoutDashboard, Menu, Upload, User, Users, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { podeAcessar, ROLE_LABELS, useUserRole, type Funcionalidade } from "@/lib/auth";

const ITENS_MENU: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  funcionalidade?: Funcionalidade;
}> = [
  { href: "/painel/inicio", label: "Início", icon: Home },
  { href: "/painel/dashboard", label: "Dashboard", icon: LayoutDashboard, funcionalidade: "dashboard" },
  {
    href: "/painel/dashboard-kpis",
    label: "Dashboard Mês a Mês",
    icon: CalendarRange,
    funcionalidade: "dashboard",
  },
  { href: "/painel/clientes", label: "Clientes", icon: Users, funcionalidade: "clientes" },
  {
    href: "/painel/importar-dados",
    label: "Importar Dados",
    icon: Upload,
    funcionalidade: "importarDados",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [aberta, setAberta] = useState(false);
  const userRole = useUserRole();
  const itensVisiveis = ITENS_MENU.filter(
    (item) => !item.funcionalidade || podeAcessar(userRole, item.funcionalidade)
  );

  return (
    <>
      <div className="flex items-center justify-between border-b bg-background p-4 lg:hidden">
        <span className="text-lg font-bold text-primary">ROMA BC</span>
        <button
          onClick={() => setAberta(!aberta)}
          className="rounded-md p-2 hover:bg-accent"
          aria-label="Abrir menu"
        >
          {aberta ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <aside
        className={cn(
          "flex w-64 shrink-0 flex-col border-r bg-background",
          "lg:flex",
          aberta ? "flex" : "hidden"
        )}
      >
        <div className="hidden border-b p-6 lg:block">
          <span className="text-xl font-bold text-primary">ROMA BC</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {itensVisiveis.map((item) => {
            // startsWith puro colidiria "/painel/dashboard-kpis" com o item
            // "/painel/dashboard" (prefixo em comum) — exige o path exato ou
            // uma sub-rota real (com "/" depois), não qualquer string que
            // comece igual.
            const ativo =
              item.href === "/painel/inicio"
                ? pathname === item.href
                : pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setAberta(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  ativo
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 border-t p-4 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          Tipo: {ROLE_LABELS[userRole]}
        </div>
      </aside>
    </>
  );
}
