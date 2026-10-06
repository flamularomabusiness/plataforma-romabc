"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

/**
 * useTheme só reflete o valor real depois da hidratação (evita mismatch
 * servidor/cliente, já que o tema vem do localStorage/preferência do SO).
 * `compacto`: botão redondo só com o ícone (usado no login).
 */
export function ThemeToggle({ className, compacto = false }: { className?: string; compacto?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);

  const escuro = montado && resolvedTheme === "dark";
  const Icone = escuro ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => setTheme(escuro ? "light" : "dark")}
      aria-label={escuro ? "Ativar modo claro" : "Ativar modo escuro"}
      className={cn(
        compacto
          ? "flex h-12 w-12 items-center justify-center rounded-full bg-card text-foreground shadow-lg transition-transform hover:scale-110"
          : "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        className
      )}
    >
      <Icone className={compacto ? "h-5 w-5" : "h-4 w-4"} />
      {!compacto && (escuro ? "Modo claro" : "Modo escuro")}
    </button>
  );
}
