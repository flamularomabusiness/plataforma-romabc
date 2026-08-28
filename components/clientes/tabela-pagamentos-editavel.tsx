"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { PagamentoStatusDropdown } from "@/components/pagamento-status-dropdown";
import { podeAcessar, useUserRole } from "@/lib/auth";
import { useAtualizarPagamento, type AtualizarPagamentoPayload } from "@/lib/queries";
import { formatBRL, formatDate } from "@/lib/utils";
import type { PagamentoProjetado } from "@/lib/types";
import { maskCurrencyToNumber, formatCurrencyInput } from "@/lib/masks";

export function TabelaPagamentosEditavel({
  pagamentos,
  clienteId,
}: {
  pagamentos: PagamentoProjetado[];
  clienteId: string;
}) {
  const userRole = useUserRole();
  const podeEditarStatus = podeAcessar(userRole, "editarStatusPagamento");

  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AtualizarPagamentoPayload>({});
  const atualizar = useAtualizarPagamento(clienteId);

  function iniciarEdicao(pagamento: PagamentoProjetado) {
    setEditId(pagamento.id);
    setForm({ valor_projetado: pagamento.valor_projetado });
  }

  function cancelarEdicao() {
    setEditId(null);
    setForm({});
  }

  async function salvar(id: string) {
    if (!form.valor_projetado || form.valor_projetado <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    try {
      await atualizar.mutateAsync({ id, payload: form });
      toast.success("Pagamento atualizado com sucesso!");
      cancelarEdicao();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar pagamento");
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Parcela</TableHead>
          <TableHead>Mês/Ano</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Vencimento</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Data Pagamento</TableHead>
          <TableHead className="text-right">Ação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pagamentos.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground">
              Nenhum pagamento projetado.
            </TableCell>
          </TableRow>
        ) : (
          pagamentos.map((pagamento) => {
            const emEdicao = editId === pagamento.id;
            return (
              <TableRow key={pagamento.id}>
                <TableCell>
                  {pagamento.numero_parcela === 0
                    ? "Entrada"
                    : pagamento.numero_parcela
                      ? `Parcela ${pagamento.numero_parcela}`
                      : "-"}
                </TableCell>
                <TableCell>
                  {String(pagamento.mes).padStart(2, "0")}/{pagamento.ano}
                </TableCell>

                <TableCell>
                  {emEdicao ? (
                    <Input
                      className="w-32"
                      value={form.valor_projetado ? formatCurrencyInput(form.valor_projetado) : ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          valor_projetado: maskCurrencyToNumber(e.target.value),
                        }))
                      }
                    />
                  ) : (
                    formatBRL(pagamento.valor_projetado)
                  )}
                </TableCell>

                <TableCell>{formatDate(pagamento.data_vencimento)}</TableCell>

                <TableCell>
                  {podeEditarStatus ? (
                    <PagamentoStatusDropdown
                      pagamentoId={pagamento.id}
                      statusAtual={pagamento.status}
                      dataPagamentoAtual={pagamento.data_pagamento_real}
                      clienteId={clienteId}
                    />
                  ) : (
                    <StatusBadge status={pagamento.status} />
                  )}
                </TableCell>

                <TableCell>{formatDate(pagamento.data_pagamento_real)}</TableCell>

                <TableCell className="text-right">
                  {emEdicao ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => salvar(pagamento.id)}
                        disabled={atualizar.isPending}
                        aria-label="Salvar"
                      >
                        <Check className="h-4 w-4 text-success" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={cancelarEdicao}
                        disabled={atualizar.isPending}
                        aria-label="Cancelar"
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => iniciarEdicao(pagamento)}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Editar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
