"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarRange,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { logout, podeAcessar, ROLE_LABELS, useUserRole, type Funcionalidade } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";

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
  {
    href: "/painel/admin/usuarios",
    label: "Gerenciar Usuários",
    icon: ShieldCheck,
    funcionalidade: "gerenciarUsuarios",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const userRole = useUserRole();
  const itensVisiveis = ITENS_MENU.filter(
    (item) => !item.funcionalidade || podeAcessar(userRole, item.funcionalidade)
  );

  async function sair() {
    await logout();
    router.push("/login");
  }

  return (
    <>
      <div className="flex items-center justify-between border-b bg-background p-3 lg:hidden">
        <Logo width={120} chip priority />
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
        <div className="hidden border-b p-5 lg:block">
          <Logo width={140} chip priority />
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
                    ? "bg-brand-gradient text-white shadow-sm"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-3 border-t p-4">
          <ThemeToggle className="w-full justify-start" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            Tipo: {ROLE_LABELS[userRole]}
          </div>
          <button
            onClick={sair}
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-brand-secondary"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
          <Logo width={72} chip className="mt-1" />
        </div>
      </aside>
    </>
  );
}
