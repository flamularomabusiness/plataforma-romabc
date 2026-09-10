"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cadastroComEmail } from "@/lib/auth";

// Sem campo de role de propósito — toda conta nova nasce "comercial" (ver
// supabase/migration_auth_usuarios.sql). Deixar escolher a role aqui
// permitiria qualquer um virar "gerente" sozinho.
const signupSchema = z
  .object({
    email: z.string().min(1, "Email é obrigatório").email("Email inválido"),
    senha: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres"),
    confirmarSenha: z.string().min(1, "Confirme a senha"),
  })
  .refine((dados) => dados.senha === dados.confirmarSenha, {
    message: "As senhas não coincidem",
    path: ["confirmarSenha"],
  });

type SignupValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", senha: "", confirmarSenha: "" },
  });

  async function onSubmit(values: SignupValues) {
    setErroGeral(null);
    setCarregando(true);
    try {
      await cadastroComEmail(values.email, values.senha);
      setSucesso(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (error) {
      setErroGeral(error instanceof Error ? error.message : "Erro ao cadastrar");
    } finally {
      setCarregando(false);
    }
  }

  if (sucesso) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="space-y-4 py-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <p className="text-lg font-semibold">Conta criada!</p>
            <p className="text-sm text-muted-foreground">
              Sua conta começa com acesso Comercial. Redirecionando para o login...
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">ROMA BC</CardTitle>
          <CardDescription>Criar conta</CardDescription>
        </CardHeader>
        <CardContent>
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
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmarSenha"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Senha</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <p className="text-xs text-muted-foreground">
                Toda conta nova começa com acesso Comercial. Um Gerente pode liberar mais acesso depois.
              </p>

              {erroGeral && <p className="text-sm font-medium text-destructive">{erroGeral}</p>}

              <Button type="submit" className="w-full" disabled={carregando}>
                {carregando ? "Cadastrando..." : "Cadastrar"}
              </Button>
            </form>
          </Form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
