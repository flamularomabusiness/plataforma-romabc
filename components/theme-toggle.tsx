"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

/**
 * useTheme só reflete o valor real depois da hidratação (evita mismatch
 * servidor/cliente, já que o tema vem do localStorage/preferência do SO).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);

  const escuro = montado && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(escuro ? "light" : "dark")}
      aria-label={escuro ? "Ativar modo claro" : "Ativar modo escuro"}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        className
      )}
    >
      {montado && escuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {escuro ? "Modo claro" : "Modo escuro"}
    </button>
  );
}
