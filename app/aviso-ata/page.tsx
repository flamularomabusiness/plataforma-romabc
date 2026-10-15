"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { logout, useUserNome } from "@/lib/auth";

const URL_DASHBOARD_ATAS = "https://dashboard-consultoria-three.vercel.app";

/**
 * Destino das consultoras (middleware.ts): elas não acessam nada da plataforma,
 * só o Dashboard de ATAs, que é um sistema à parte. Fica fora de /painel de
 * propósito — sem sidebar, sem navbar, sem nenhum link pra dentro do sistema.
 */
export default function AvisoAtaPage() {
  const router = useRouter();
  const nome = useUserNome();
  const primeiroNome = nome?.split(" ")[0];

  async function sair() {
    await logout();
    router.push("/login");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#E8EFFF] via-[#F0F4FF] to-[#E3EBFF] px-4 pb-10 pt-24 sm:py-10 dark:from-[#0E0F11] dark:via-[#131619] dark:to-[#0A0B0D]">
      <div className="login-blob login-blob-1" aria-hidden />
      <div className="login-blob login-blob-2" aria-hidden />
      <div className="login-blob login-blob-3" aria-hidden />

      <ThemeToggle compacto className="fixed right-5 top-5 z-50" />

      <div className="relative z-10 w-full max-w-[460px] rounded-3xl border border-white/50 bg-card/95 px-8 py-12 text-center shadow-[0_20px_60px_rgba(0,28,107,0.12)] backdrop-blur-md dark:border-white/10 dark:shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        {/* O logo tem texto escuro fixo: no tema escuro precisa de um fundo claro atrás. */}
        <div className="mb-8 flex justify-center">
          <div className="dark:hidden">
            <Logo width={200} priority />
          </div>
          <div className="hidden dark:block">
            <Logo width={200} chip priority />
          </div>
        </div>

        {primeiroNome && <p className="mb-2 text-sm text-muted-foreground">Olá, {primeiroNome}</p>}
        <h1 className="mb-3 text-[26px] font-bold leading-tight">Seu acesso é ao Dashboard de ATAs</h1>
        <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
          Seu perfil de consultora utiliza o Dashboard de ATAs. As demais áreas da plataforma ROMABC ONE não
          estão disponíveis para este perfil.
        </p>

        <div className="flex flex-col gap-3">
          <Button
            asChild
            className="group h-12 gap-2.5 rounded-2xl bg-brand-gradient text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(0,28,107,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(0,28,107,0.35)]"
          >
            <a href={URL_DASHBOARD_ATAS} target="_blank" rel="noopener noreferrer">
              Abrir Dashboard de ATAs
              <ArrowRight className="h-[18px] w-[18px] transition-transform group-hover:translate-x-1" />
            </a>
          </Button>

          <Button type="button" variant="ghost" onClick={sair} className="h-11 gap-2 rounded-2xl text-muted-foreground">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    </main>
  );
}
