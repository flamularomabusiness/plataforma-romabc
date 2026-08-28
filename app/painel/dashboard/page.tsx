"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { DollarSign, FileText, Users, Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/kpi-card";
import { StatusBadge } from "@/components/status-badge";
import { useKPIs, usePagamentosDoMes, useReceitaMensal } from "@/lib/queries";
import { formatBRL, formatDate, GRAU_DIFICULDADE_LABELS } from "@/lib/utils";
import { GRAUS_DIFICULDADE } from "@/lib/types";
import { hasAccess } from "@/lib/auth";

// Recharts é uma dependência pesada (~100kb+ de JS); carregando sob demanda em
// vez de no bundle estático, quem nunca abre o Dashboard nunca paga esse custo,
// e quem abre só espera o parse dela quando este gráfico específico é exibido.
const RevenueChart = dynamic(
  () => import("@/components/revenue-chart").then((mod) => mod.RevenueChart),
  { ssr: false, loading: () => <Skeleton className="h-80 w-full" /> }
);

const PAGAMENTOS_POR_PAGINA = 10;

const GRAU_TEXT_CLASS: Record<(typeof GRAUS_DIFICULDADE)[number], string> = {
  BAIXO: "text-success",
  MEDIO: "text-warning",
  ALTO: "text-destructive",
};

export default function DashboardPage() {
  const router = useRouter();
  const [pagina, setPagina] = useState(1);
  const [acessoLiberado, setAcessoLiberado] = useState<boolean | null>(null);

  useEffect(() => {
    if (hasAccess("dashboard")) {
      setAcessoLiberado(true);
    } else {
      setAcessoLiberado(false);
      router.push("/painel/clientes");
    }
  }, [router]);

  const { data: kpis, isLoading: loadingKpis } = useKPIs();
  const { data: pagamentos, isLoading: loadingPagamentos } = usePagamentosDoMes(
    pagina,
    PAGAMENTOS_POR_PAGINA
  );
  const { data: receita, isLoading: loadingReceita } = useReceitaMensal();

  const totalPaginas = pagamentos
    ? Math.max(1, Math.ceil(pagamentos.total / PAGAMENTOS_POR_PAGINA))
    : 1;

  if (!acessoLiberado) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loadingKpis ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
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
            <KpiCard
              titulo="Pagamentos Pendentes"
              valor={String(kpis?.pagamentos_pendentes ?? 0)}
              icone={Clock}
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Clientes por Dificuldade</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingKpis ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="grid grid-cols-3 gap-4 text-center">
              {GRAUS_DIFICULDADE.map((grau) => (
                <div key={grau} className="rounded-lg border p-4">
                  <div className={`text-3xl font-bold ${GRAU_TEXT_CLASS[grau]}`}>
                    {kpis?.clientes_por_dificuldade[grau] ?? 0}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {GRAU_DIFICULDADE_LABELS[grau]}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Receita Projetada vs Realizada</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingReceita ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <RevenueChart data={receita ?? []} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pagamentos do Mês</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPagamentos ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(pagamentos?.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhum pagamento neste mês.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagamentos?.data.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.cliente_nome}</TableCell>
                        <TableCell>{p.produto_nome}</TableCell>
                        <TableCell>{formatBRL(p.valor)}</TableCell>
                        <TableCell>{formatDate(p.data_vencimento)}</TableCell>
                        <TableCell>
                          <StatusBadge status={p.status} size="sm" />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Página {pagina} de {totalPaginas}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagina <= 1}
                    onClick={() => setPagina((p) => p - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagina >= totalPaginas}
                    onClick={() => setPagina((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
