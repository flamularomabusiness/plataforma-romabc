"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { loginComEmail } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().min(1, "Email é obrigatório").email("Email inválido"),
  senha: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres"),
});

type LoginValues = z.infer<typeof loginSchema>;

const CLASSE_INPUT =
  "h-12 rounded-[14px] border-brand-primary/20 bg-slate-50/70 pl-12 text-[15px] focus-visible:border-brand-secondary focus-visible:bg-white focus-visible:ring-brand-secondary/20 focus-visible:ring-offset-0 dark:border-white/10 dark:bg-background/60 dark:focus-visible:border-brand-accent dark:focus-visible:bg-background dark:focus-visible:ring-brand-accent/20";

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#E8EFFF] via-[#F0F4FF] to-[#E3EBFF] px-4 pb-10 pt-24 sm:py-10 dark:from-[#0E0F11] dark:via-[#131619] dark:to-[#0A0B0D]">
      <div className="login-blob login-blob-1" aria-hidden />
      <div className="login-blob login-blob-2" aria-hidden />
      <div className="login-blob login-blob-3" aria-hidden />

      <ThemeToggle compacto className="fixed right-5 top-5 z-50" />

      <div className="relative z-10 w-full max-w-[420px] rounded-3xl border border-white/50 bg-card/95 px-8 py-12 text-center shadow-[0_20px_60px_rgba(0,28,107,0.12)] backdrop-blur-md dark:border-white/10 dark:shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        {/* O logo tem texto escuro fixo: no tema escuro precisa de um fundo claro atrás. */}
        <div className="mb-8 flex justify-center">
          <div className="dark:hidden">
            <Logo width={200} priority />
          </div>
          <div className="hidden dark:block">
            <Logo width={200} chip priority />
          </div>
        </div>

        <h1 className="mb-2 text-[28px] font-bold">Bem-vindo de volta</h1>
        <p className="mb-8 text-sm tracking-wide text-muted-foreground">Entre com seu email e senha para continuar</p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 text-left">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Email</FormLabel>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="voce@romabc.com.br"
                        className={CLASSE_INPUT}
                        {...field}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="senha"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Senha</FormLabel>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder="Senha"
                        className={CLASSE_INPUT}
                        {...field}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {erroGeral && <p className="text-sm font-medium text-destructive">{erroGeral}</p>}

            <Button
              type="submit"
              disabled={carregando}
              className="group mt-2 h-12 gap-2.5 rounded-2xl bg-brand-gradient text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(0,28,107,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(0,28,107,0.35)] active:translate-y-0"
            >
              {carregando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="h-[18px] w-[18px] transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </form>
        </Form>

        <p className="mt-6 text-sm text-muted-foreground">
          Não tem conta?{" "}
          <Link href="/signup" className="font-medium text-brand-secondary hover:underline dark:text-brand-accent">
            Criar conta
          </Link>
        </p>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Tudo da sua empresa em um só lugar
        </p>
      </div>
    </main>
  );
}
