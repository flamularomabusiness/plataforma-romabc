"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, Search, ShieldCheck, Trash2, UserPlus } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { StatusFilter } from "@/components/status-filter";
import { ModalAdicionarPessoa } from "@/components/clientes/modal-adicionar-pessoa";
import { DialogDeletarCliente } from "@/components/clientes/dialog-deletar-cliente";
import { useClientes, useRestaurarCliente } from "@/lib/queries";
import { podeAcessar, useUserRole } from "@/lib/auth";
import { formatBRL, formatDate, GRAU_DIFICULDADE_LABELS, getGrauDificuldadeBadgeVariant } from "@/lib/utils";
import type { StatusCliente } from "@/lib/types";

const POR_PAGINA = 50;

export default function ClientesPage() {
  const userRole = useUserRole();
  const podeAdicionarPessoa = podeAcessar(userRole, "adicionarPessoa");
  const podeDeletar = podeAcessar(userRole, "deletarCliente");
  const ehAdministrator = userRole === "administrator";

  const [buscaInput, setBuscaInput] = useState("");
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<StatusCliente | "TODOS">("TODOS");
  const [pagina, setPagina] = useState(1);
  const [mostrarDeletados, setMostrarDeletados] = useState(false);
  const [clienteParaPessoa, setClienteParaPessoa] = useState<{
    id: string;
    nome_razao_social: string;
  } | null>(null);
  const [clienteParaDeletar, setClienteParaDeletar] = useState<{
    id: string;
    nome_razao_social: string;
    cpf_cnpj_responsavel: string;
    contratos_count: number;
  } | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setBusca(buscaInput);
      setPagina(1);
    }, 350);
    return () => clearTimeout(timeout);
  }, [buscaInput]);

  const { data, isLoading } = useClientes({
    busca,
    status,
    pagina,
    porPagina: POR_PAGINA,
    mostrarDeletados: ehAdministrator && mostrarDeletados,
  });
  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / POR_PAGINA)) : 1;
  const restaurar = useRestaurarCliente();

  function copiarCNPJ(cnpj: string) {
    navigator.clipboard.writeText(cnpj);
    toast.success("CNPJ copiado");
  }

  async function handleRestaurar(clienteId: string, nome: string) {
    if (!window.confirm(`Restaurar "${nome}"? Ele volta a aparecer na listagem normal.`)) return;
    try {
      await restaurar.mutateAsync(clienteId);
      toast.success("Cliente restaurado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao restaurar cliente");
    }
  }

  const mostrandoDeletados = ehAdministrator && mostrarDeletados;
  const temColunaAcoes = podeAdicionarPessoa || podeDeletar || mostrandoDeletados;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Clientes</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              className="pl-9"
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
            />
          </div>
          <StatusFilter
            value={status}
            onStatusChange={(v) => {
              setStatus(v);
              setPagina(1);
            }}
          />
          {ehAdministrator && (
            <Button
              type="button"
              variant={mostrarDeletados ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMostrarDeletados((v) => !v);
                setPagina(1);
              }}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              {mostrarDeletados ? "Ver clientes ativos" : "Ver clientes ocultados"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Contratos Ativos</TableHead>
                    <TableHead>Grau de Dificuldade</TableHead>
                    <TableHead>Status</TableHead>
                    {mostrandoDeletados && <TableHead>Ocultado em</TableHead>}
                    {temColunaAcoes && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7 + (mostrandoDeletados ? 1 : 0) + (temColunaAcoes ? 1 : 0)}
                        className="text-center text-muted-foreground"
                      >
                        {mostrandoDeletados ? "Nenhum cliente ocultado." : "Nenhum cliente encontrado."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.data.map((cliente) => (
                      <TableRow key={cliente.id}>
                        <TableCell>
                          <Link
                            href={`/painel/clientes/${cliente.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {cliente.nome_razao_social}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => copiarCNPJ(cliente.cpf_cnpj_responsavel)}
                            className="inline-flex items-center gap-1.5 text-sm hover:text-primary"
                          >
                            {cliente.cpf_cnpj_responsavel}
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                        <TableCell>{cliente.email_responsavel ?? "-"}</TableCell>
                        <TableCell>{formatBRL(cliente.valor_total)}</TableCell>
                        <TableCell>{cliente.contratos_ativos_count}</TableCell>
                        <TableCell>
                          {cliente.grau_dificuldade ? (
                            <Badge variant={getGrauDificuldadeBadgeVariant(cliente.grau_dificuldade)}>
                              {GRAU_DIFICULDADE_LABELS[cliente.grau_dificuldade]}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={cliente.status} />
                        </TableCell>
                        {mostrandoDeletados && (
                          <TableCell className="text-muted-foreground">
                            {formatDate(cliente.deletado_em)}
                          </TableCell>
                        )}
                        {temColunaAcoes && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {mostrandoDeletados ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRestaurar(cliente.id, cliente.nome_razao_social)}
                                  disabled={restaurar.isPending}
                                >
                                  <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                                  Restaurar
                                </Button>
                              ) : (
                                <>
                                  {podeAdicionarPessoa && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      title="Adicionar pessoa"
                                      onClick={() =>
                                        setClienteParaPessoa({
                                          id: cliente.id,
                                          nome_razao_social: cliente.nome_razao_social,
                                        })
                                      }
                                    >
                                      <UserPlus className="mr-2 h-3.5 w-3.5" />
                                      Pessoa
                                    </Button>
                                  )}
                                  {podeDeletar && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      title="Deletar cliente"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() =>
                                        setClienteParaDeletar({
                                          id: cliente.id,
                                          nome_razao_social: cliente.nome_razao_social,
                                          cpf_cnpj_responsavel: cliente.cpf_cnpj_responsavel,
                                          contratos_count: cliente.contratos_count,
                                        })
                                      }
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                        )}
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

      <ModalAdicionarPessoa
        cliente={clienteParaPessoa}
        open={!!clienteParaPessoa}
        onOpenChange={(open) => {
          if (!open) setClienteParaPessoa(null);
        }}
      />

      <DialogDeletarCliente
        cliente={clienteParaDeletar}
        open={!!clienteParaDeletar}
        onOpenChange={(open) => {
          if (!open) setClienteParaDeletar(null);
        }}
      />
    </div>
  );
}
