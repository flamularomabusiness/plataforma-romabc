"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Star } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { useClienteDetalhes } from "@/lib/queries";
import {
  cn,
  formatBRL,
  formatDate,
  GRAU_DIFICULDADE_LABELS,
  getGrauDificuldadeBadgeVariant,
} from "@/lib/utils";
import {
  STATUS_PAGAMENTO,
  type StatusCliente,
  type StatusContrato,
  type StatusPagamento,
  type TipoPagamento,
} from "@/lib/types";

const STATUS_PAGAMENTO_FILTRO_LABEL: Record<StatusPagamento, string> = {
  PROJETADO: "Projetados",
  PAGO: "Pagos",
  ATRASADO: "Atrasados",
  INADIMPLENTE: "Inadimplentes",
};

const STATUS_CLIENTE_CARD_CLASS: Record<StatusCliente, string> = {
  ATIVO: "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950",
  INATIVO: "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900",
  INADIMPLENTE: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950",
};

const TIPO_PAGAMENTO_LABEL: Record<TipoPagamento, string> = {
  recorrente: "Recorrente",
  venda_unica: "Venda Única",
  parcelado: "Parcelado",
};

function resumoPagamento(contrato: {
  tipo_pagamento: TipoPagamento;
  valor_mensal: number | null;
  data_vencimento_mensal: number | null;
  valor_total: number | null;
  numero_parcelas: number | null;
}): string {
  if (contrato.tipo_pagamento === "recorrente") {
    return `Recorrente: ${formatBRL(contrato.valor_mensal)}/mês (vence dia ${contrato.data_vencimento_mensal ?? "-"})`;
  }
  if (contrato.tipo_pagamento === "venda_unica") {
    return `Venda Única: ${formatBRL(contrato.valor_total)}`;
  }
  return `Parcelado: ${formatBRL(contrato.valor_total)} em ${contrato.numero_parcelas ?? "-"} parcelas`;
}

const FUNCAO_LABELS: Record<string, string> = {
  RESPONSAVEL: "Responsável",
  FINANCEIRO: "Financeiro",
  SOCIO: "Sócio",
  DONO: "Dono",
  FUNCIONARIO: "Funcionário",
  OUTRO: "Outro",
};

const FUNCAO_PESSOA_LABELS: Record<string, string> = {
  DONO: "Dono",
  FINANCEIRO: "Financeiro",
  SOCIO: "Sócio",
  OUTRO: "Outros",
};

const STATUS_CONTRATO_VARIANT: Record<StatusContrato, "success" | "secondary" | "destructive"> = {
  ativo: "success",
  inativo: "secondary",
  cancelado: "destructive",
};

export default function ClienteDetalhesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [filtroStatusPagamento, setFiltroStatusPagamento] = useState<StatusPagamento | "TODOS">(
    "TODOS"
  );
  const { data: cliente, isLoading, isError } = useClienteDetalhes(params.id);

  const pagamentos = cliente?.pagamentos_projetados ?? [];

  const pagamentosFiltrados = useMemo(
    () =>
      filtroStatusPagamento === "TODOS"
        ? pagamentos
        : pagamentos.filter((p) => p.status === filtroStatusPagamento),
    [pagamentos, filtroStatusPagamento]
  );

  // Pendentes = ainda não recebidos (tudo exceto PAGO). Contagem + soma R$ por status.
  const resumoPendentes = useMemo(() => {
    const buckets: Record<Exclude<StatusPagamento, "PAGO">, { count: number; total: number }> = {
      PROJETADO: { count: 0, total: 0 },
      ATRASADO: { count: 0, total: 0 },
      INADIMPLENTE: { count: 0, total: 0 },
    };
    for (const p of pagamentos) {
      if (p.status === "PAGO") continue;
      buckets[p.status].count += 1;
      buckets[p.status].total += Number(p.valor_projetado ?? 0);
    }
    return buckets;
  }, [pagamentos]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !cliente) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push("/painel/clientes")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <p className="text-muted-foreground">Cliente não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/painel/clientes")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">{cliente.nome_razao_social}</h1>
        </div>
        <Button asChild size="sm">
          <Link href={`/painel/clientes/${cliente.id}/editar`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar Cliente
          </Link>
        </Button>
      </div>

      <Card className={cn("border-2", STATUS_CLIENTE_CARD_CLASS[cliente.status])}>
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <span className="text-sm font-medium text-muted-foreground">Status do Cliente</span>
          <StatusBadge status={cliente.status} size="lg" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados da Empresa</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Razão Social</p>
            <p className="font-medium">{cliente.nome_razao_social}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">CNPJ</p>
            <p className="font-medium">{cliente.cpf_cnpj_responsavel}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Faturamento Médio</p>
            <p className="font-medium">{formatBRL(cliente.faturamento_medio)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Cidade/UF</p>
            <p className="font-medium">
              {cliente.cidade}/{cliente.estado}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Empresas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Razão Social</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Faturamento Médio</TableHead>
                <TableHead>Contrato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cliente.contratos.flatMap((c) => c.empresas).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhuma empresa vinculada.
                  </TableCell>
                </TableRow>
              ) : (
                cliente.contratos.flatMap((contrato) =>
                  contrato.empresas.map((empresa) => (
                    <TableRow key={`${contrato.id}-${empresa.id}`}>
                      <TableCell className="font-medium">{empresa.nome_razao_social}</TableCell>
                      <TableCell>{empresa.cpf_cnpj_responsavel}</TableCell>
                      <TableCell>
                        {empresa.cidade}/{empresa.estado}
                      </TableCell>
                      <TableCell>{formatBRL(empresa.faturamento_medio)}</TableCell>
                      <TableCell>{contrato.produto?.nome ?? "-"}</TableCell>
                    </TableRow>
                  ))
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contatos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Rede Social</TableHead>
                <TableHead>Data Nasc.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cliente.contatos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum contato cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                cliente.contatos.map((contato) => (
                  <TableRow key={contato.id}>
                    <TableCell className="font-medium">{contato.nome}</TableCell>
                    <TableCell>{contato.email}</TableCell>
                    <TableCell>{contato.telefone}</TableCell>
                    <TableCell>
                      {contato.funcao === "OUTRO" && contato.descricao_outro
                        ? contato.descricao_outro
                        : FUNCAO_LABELS[contato.funcao]}
                    </TableCell>
                    <TableCell>{contato.rede_social ?? "-"}</TableCell>
                    <TableCell>{formatDate(contato.data_nascimento)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pessoas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome Completo</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Principal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cliente.contratos.flatMap((c) => c.pessoas).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Nenhuma pessoa cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                cliente.contratos.flatMap((contrato) =>
                  contrato.pessoas.map((pessoa) => (
                    <TableRow key={pessoa.id}>
                      <TableCell className="font-medium">{pessoa.nome_completo}</TableCell>
                      <TableCell>{pessoa.cpf}</TableCell>
                      <TableCell>{pessoa.email}</TableCell>
                      <TableCell>{pessoa.telefone}</TableCell>
                      <TableCell>{FUNCAO_PESSOA_LABELS[pessoa.funcao]}</TableCell>
                      <TableCell>{contrato.produto?.nome ?? "-"}</TableCell>
                      <TableCell>
                        {pessoa.eh_principal && (
                          <Star className="h-4 w-4 fill-primary text-primary" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contratos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>UNE</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Grau de Dificuldade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cliente.contratos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum contrato cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                cliente.contratos.map((contrato) => (
                  <TableRow key={contrato.id}>
                    <TableCell className="font-medium">
                      {contrato.produto?.nome ?? "-"}
                    </TableCell>
                    <TableCell>{contrato.une?.nome ?? "-"}</TableCell>
                    <TableCell>{TIPO_PAGAMENTO_LABEL[contrato.tipo_pagamento]}</TableCell>
                    <TableCell>{resumoPagamento(contrato)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_CONTRATO_VARIANT[contrato.status]}>
                        {contrato.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getGrauDificuldadeBadgeVariant(contrato.grau_dificuldade)}>
                        {GRAU_DIFICULDADE_LABELS[contrato.grau_dificuldade]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pagamentos Pendentes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {(["PROJETADO", "ATRASADO", "INADIMPLENTE"] as const).map((status) => (
            <div key={status} className="rounded-lg border p-4">
              <div className="mb-1 flex items-center justify-between">
                <StatusBadge status={status} size="sm" />
                <span className="text-sm text-muted-foreground">
                  {resumoPendentes[status].count} pagamento
                  {resumoPendentes[status].count === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-lg font-semibold">{formatBRL(resumoPendentes[status].total)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">Pagamentos Projetados</CardTitle>
          <Select
            value={filtroStatusPagamento}
            onValueChange={(v) => setFiltroStatusPagamento(v as StatusPagamento | "TODOS")}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os status</SelectItem>
              {STATUS_PAGAMENTO.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_PAGAMENTO_FILTRO_LABEL[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parcela</TableHead>
                <TableHead>Mês/Ano</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagamentosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum pagamento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                pagamentosFiltrados.map((pagamento, index) => (
                  <TableRow key={pagamento.id}>
                    <TableCell>
                      {pagamento.numero_parcela === 0
                        ? "Entrada"
                        : pagamento.numero_parcela
                          ? `Parcela ${pagamento.numero_parcela}`
                          : `${index + 1}/${pagamentosFiltrados.length}`}
                    </TableCell>
                    <TableCell>
                      {String(pagamento.mes).padStart(2, "0")}/{pagamento.ano}
                    </TableCell>
                    <TableCell>{formatBRL(pagamento.valor_projetado)}</TableCell>
                    <TableCell>{formatDate(pagamento.data_vencimento)}</TableCell>
                    <TableCell>
                      <StatusBadge status={pagamento.status} size="sm" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
