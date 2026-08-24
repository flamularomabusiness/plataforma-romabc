"use client";

import { useRouter } from "next/navigation";
import { Briefcase, UserCog, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { setUserRole, type UserRole } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();

  function entrarComo(role: UserRole) {
    setUserRole(role);
    router.push("/painel/inicio");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-primary">ROMA BC</CardTitle>
          <CardDescription>
            Login simplificado da Fase 1 — a role fica salva no navegador até termos
            autenticação de verdade.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={() => entrarComo("comercial")}>
            <Briefcase className="mr-2 h-4 w-4" />
            Entrar como Comercial
          </Button>
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => entrarComo("gerente")}
          >
            <UserCog className="mr-2 h-4 w-4" />
            Entrar como Gerente
          </Button>
          <Button
            className="w-full"
            variant="outline"
            onClick={() => entrarComo("financeiro")}
          >
            <Wallet className="mr-2 h-4 w-4" />
            Entrar como Financeiro
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
