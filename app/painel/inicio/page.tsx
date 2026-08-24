"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DollarSign, FileText, LayoutDashboard, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/kpi-card";
import { useKPIs } from "@/lib/queries";
import { formatBRL } from "@/lib/utils";
import { clearUserRole, podeAcessar, ROLE_LABELS, useUserRole } from "@/lib/auth";

function AcaoCard({
  icon: Icon,
  titulo,
  descricao,
  href,
  textoBotao,
}: {
  icon: LucideIcon;
  titulo: string;
  descricao: string;
  href: string;
  textoBotao: string;
}) {
  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-4 pt-6">
        <Icon className="h-8 w-8 text-primary" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{titulo}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
        </div>
        <Button asChild>
          <Link href={href}>{textoBotao}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function InicioPage() {
  const router = useRouter();
  const userRole = useUserRole();
  const { data: kpis, isLoading: loadingKpis } = useKPIs();

  function trocarUsuario() {
    clearUserRole();
    router.push("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Início</h1>
        <p className="text-muted-foreground">Bem-vindo, {ROLE_LABELS[userRole]}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {podeAcessar(userRole, "dashboard") && (
          <AcaoCard
            icon={LayoutDashboard}
            titulo={userRole === "financeiro" ? "Dashboard Financeiro" : "Dashboard"}
            descricao={
              userRole === "financeiro"
                ? "Receitas, pagamentos e projeções financeiras."
                : "KPIs, receita projetada e clientes por dificuldade."
            }
            href="/painel/dashboard"
            textoBotao="Abrir Dashboard"
          />
        )}

        {podeAcessar(userRole, "clientes") && (
          <AcaoCard
            icon={Users}
            titulo="Gerenciar Clientes"
            descricao="Veja clientes, contatos, contratos e histórico de pagamentos."
            href="/painel/clientes"
            textoBotao="Ver Clientes"
          />
        )}

        {podeAcessar(userRole, "formulario") && (
          <AcaoCard
            icon={FileText}
            titulo="Novo Contrato"
            descricao="Cadastre cliente, contatos, produto e condições de pagamento."
            href="/formulario"
            textoBotao="Novo Contrato"
          />
        )}
      </div>

      {userRole === "gerente" &&
        (loadingKpis ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              titulo="Clientes Ativos"
              valor={String(kpis?.clientes_ativos ?? 0)}
              icone={Users}
            />
            <KpiCard
              titulo="Receita Mensal Projetada"
              valor={formatBRL(kpis?.receita_mensal_projetada ?? 0)}
              icone={DollarSign}
            />
            <KpiCard
              titulo="Contratos Ativos"
              valor={String(kpis?.contratos_ativos ?? 0)}
              icone={FileText}
            />
          </div>
        ))}

      {userRole === "comercial" && (
        <div className="rounded-lg border-l-4 border-primary bg-muted p-4 text-sm">
          <strong>Dica:</strong> para acessar o Dashboard com análises completas, peça
          acesso ao seu Gerente.
        </div>
      )}

      {userRole === "financeiro" && (
        <div className="rounded-lg border-l-4 border-warning bg-muted p-4 text-sm">
          <strong>Acesso Financeiro:</strong> você pode visualizar pagamentos, mas não
          pode criar novos contratos. Fale com o Gerente se precisar.
        </div>
      )}

      <div className="text-center">
        <Button variant="link" onClick={trocarUsuario}>
          Trocar de usuário
        </Button>
      </div>
    </div>
  );
}
