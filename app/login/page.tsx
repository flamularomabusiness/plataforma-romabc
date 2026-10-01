"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Logo } from "@/components/logo";
import { loginComEmail } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().min(1, "Email é obrigatório").email("Email inválido"),
  senha: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres"),
});

type LoginValues = z.infer<typeof loginSchema>;

/**
 * Linhas decorativas curvas nas laterais — efeito "tech" em movimento
 * (stroke-dasharray + dashoffset animado em .linha-fluxo, globals.css).
 * Duração/atraso variam por linha pra não ficarem todas em sincronia.
 */
function LinhasDecorativas() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 1200 800"
      fill="none"
      aria-hidden
    >
      <path
        d="M -100 140 C 150 40, 250 220, 480 120 S 760 -40, 1000 80"
        stroke="#5E8CFF"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.3"
        className="linha-fluxo"
        style={{ animationDuration: "7s" }}
      />
      <path
        d="M -120 300 C 120 220, 260 400, 520 280 S 820 140, 1100 260"
        stroke="#5E8CFF"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.22"
        className="linha-fluxo"
        style={{ animationDuration: "9s", animationDirection: "reverse" }}
      />
      <path
        d="M -80 460 C 180 400, 300 560, 560 440 S 840 320, 1120 420"
        stroke="#FFFFFF"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.12"
        className="linha-fluxo"
        style={{ animationDuration: "11s" }}
      />
      <path
        d="M 100 820 C 320 700, 480 880, 700 740 S 980 580, 1300 680"
        stroke="#5E8CFF"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.3"
        className="linha-fluxo"
        style={{ animationDuration: "8s", animationDirection: "reverse" }}
      />
      <path
        d="M 60 700 C 280 620, 420 760, 660 640 S 940 500, 1260 580"
        stroke="#FFFFFF"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.12"
        className="linha-fluxo"
        style={{ animationDuration: "10s" }}
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", senha: "" },
  });

  async function onSubmit(values: LoginValues) {
    setErroGeral(null);
    setCarregando(true);
    try {
      await loginComEmail(values.email, values.senha);
      router.push("/painel/inicio");
      router.refresh();
    } catch (error) {
      setErroGeral(error instanceof Error ? error.message : "Erro ao entrar");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-gradient-deep px-4">
      <LinhasDecorativas />

      <div className="theme-force-light relative z-10 w-full max-w-sm rounded-2xl bg-white/95 p-8 text-foreground shadow-2xl backdrop-blur-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo width={220} priority />
          <p className="text-sm text-muted-foreground">Entre com seu email e senha</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" placeholder="voce@romabc.com.br" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="senha"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {erroGeral && <p className="text-sm font-medium text-destructive">{erroGeral}</p>}

            <Button
              type="submit"
              className="w-full bg-brand-gradient text-white hover:opacity-90"
              disabled={carregando}
            >
              {carregando ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </Form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Não tem conta?{" "}
          <Link href="/signup" className="font-medium text-brand-secondary hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </main>
  );
}
