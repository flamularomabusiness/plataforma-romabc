"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, Search, UserPlus } from "lucide-react";

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
import { useClientes } from "@/lib/queries";
import { podeAcessar, useUserRole } from "@/lib/auth";
import { formatBRL, GRAU_DIFICULDADE_LABELS, getGrauDificuldadeBadgeVariant } from "@/lib/utils";
import type { StatusCliente } from "@/lib/types";

const POR_PAGINA = 50;

export default function ClientesPage() {
  const userRole = useUserRole();
  const podeAdicionarPessoa = podeAcessar(userRole, "adicionarPessoa");

  const [buscaInput, setBuscaInput] = useState("");
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<StatusCliente | "TODOS">("TODOS");
  const [pagina, setPagina] = useState(1);
  const [clienteParaPessoa, setClienteParaPessoa] = useState<{
    id: string;
    nome_razao_social: string;
  } | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setBusca(buscaInput);
      setPagina(1);
    }, 350);
    return () => clearTimeout(timeout);
  }, [buscaInput]);

  const { data, isLoading } = useClientes({ busca, status, pagina, porPagina: POR_PAGINA });
  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / POR_PAGINA)) : 1;

  function copiarCNPJ(cnpj: string) {
    navigator.clipboard.writeText(cnpj);
    toast.success("CNPJ copiado");
  }

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
                    {podeAdicionarPessoa && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={podeAdicionarPessoa ? 8 : 7}
                        className="text-center text-muted-foreground"
                      >
                        Nenhum cliente encontrado.
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
                        {podeAdicionarPessoa && (
                          <TableCell className="text-right">
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
    </div>
  );
}
