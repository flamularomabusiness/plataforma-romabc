"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { loginComEmail } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().min(1, "Email é obrigatório").email("Email inválido"),
  senha: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres"),
});

type LoginValues = z.infer<typeof loginSchema>;

/** Linhas decorativas diagonais nas laterais — efeito visual "tech" do design ROMABC ONE. */
function LinhasDecorativas() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 1200 800"
      aria-hidden
    >
      <g stroke="#5E8CFF" strokeWidth="1.5" opacity="0.25">
        <line x1="-100" y1="120" x2="400" y2="-100" />
        <line x1="-60" y1="260" x2="440" y2="40" />
        <line x1="-20" y1="400" x2="480" y2="180" />
        <line x1="20" y1="540" x2="520" y2="320" />
        <line x1="900" y1="900" x2="1300" y2="600" />
        <line x1="840" y1="880" x2="1260" y2="500" />
        <line x1="780" y1="860" x2="1220" y2="420" />
      </g>
      <g stroke="#FFFFFF" strokeWidth="1" opacity="0.1">
        <line x1="-100" y1="60" x2="360" y2="-160" />
        <line x1="960" y1="900" x2="1340" y2="660" />
      </g>
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-gradient px-4">
      <LinhasDecorativas />

      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white/95 p-8 shadow-2xl backdrop-blur-sm dark:bg-card/95">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Image src="/romabc-one-logo.png" alt="ROMABC ONE" width={220} height={79} priority />
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
