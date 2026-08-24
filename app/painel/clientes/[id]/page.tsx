"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClienteDetalhes } from "@/lib/queries";
import {
  formatBRL,
  formatDate,
  GRAU_DIFICULDADE_LABELS,
  getGrauDificuldadeBadgeVariant,
} from "@/lib/utils";
import type { StatusContrato, StatusPagamento } from "@/lib/types";

const FUNCAO_LABELS: Record<string, string> = {
  RESPONSAVEL: "Responsável",
  FINANCEIRO: "Financeiro",
  SOCIO: "Sócio",
  DONO: "Dono",
  FUNCIONARIO: "Funcionário",
  OUTRO: "Outro",
};

const STATUS_CONTRATO_VARIANT: Record<StatusContrato, "success" | "secondary" | "destructive"> = {
  ativo: "success",
  inativo: "secondary",
  cancelado: "destructive",
};

const STATUS_PAGAMENTO_VARIANT: Record<
  StatusPagamento,
  "success" | "warning" | "destructive" | "secondary"
> = {
  pago: "success",
  projetado: "warning",
  atrasado: "destructive",
  cancelado: "secondary",
};

export default function ClienteDetalhesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: cliente, isLoading, isError } = useClienteDetalhes(params.id);

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
          <CardTitle className="text-lg">Contratos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>UNE</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Grau de Dificuldade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cliente.contratos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                    <TableCell>{formatBRL(contrato.valor_mensal)}</TableCell>
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
          <CardTitle className="text-lg">Pagamentos Projetados</CardTitle>
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
              {cliente.pagamentos_projetados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum pagamento projetado.
                  </TableCell>
                </TableRow>
              ) : (
                cliente.pagamentos_projetados.map((pagamento, index) => (
                  <TableRow key={pagamento.id}>
                    <TableCell>{index + 1}/{cliente.pagamentos_projetados.length}</TableCell>
                    <TableCell>
                      {String(pagamento.mes).padStart(2, "0")}/{pagamento.ano}
                    </TableCell>
                    <TableCell>{formatBRL(pagamento.valor_projetado)}</TableCell>
                    <TableCell>{formatDate(pagamento.data_vencimento)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_PAGAMENTO_VARIANT[pagamento.status]}>
                        {pagamento.status}
                      </Badge>
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
