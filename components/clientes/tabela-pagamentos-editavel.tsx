"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Lock, Pencil, X } from "lucide-react";

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

/** Hoje em "YYYY-MM-DD" — comparável por ordem lexicográfica com data_vencimento. */
function hojeISO(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(
    hoje.getDate()
  ).padStart(2, "0")}`;
}

const TOLERANCIA_JANELA_DIAS = 45;

/**
 * "Dentro da janela do contrato" seria o ideal, mas contratos vêm de mais de
 * um fluxo de criação (import Excel, formulário Novo Contrato, cada um
 * preenchendo campos diferentes — parcelado por import não tem
 * data_inicio_primeiro_pagamento, por exemplo) — calcular a janela "de
 * verdade" a partir de metadados do contrato seria frágil e podia bloquear
 * edições válidas em contratos mais antigos. Em vez disso, usa a própria
 * janela observada nos OUTROS pagamentos deste mesmo contrato (min/max das
 * datas já cadastradas) com uma folga de 45 dias pra cada lado — pega o
 * mesmo tipo de erro grosseiro (mover um pagamento pra 2 anos no futuro) sem
 * depender de dado que pode não existir.
 */
function calcularJanela(
  pagamentos: PagamentoProjetado[],
  contratoId: string,
  excluirId: string
): { min: string; max: string } | null {
  const datas = pagamentos
    .filter((p) => p.contrato_id === contratoId && p.id !== excluirId && p.data_vencimento)
    .map((p) => p.data_vencimento as string)
    .sort();
  if (datas.length === 0) return null;

  const folga = (iso: string, dias: number) => {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  };
  return {
    min: folga(datas[0], -TOLERANCIA_JANELA_DIAS),
    max: folga(datas[datas.length - 1], TOLERANCIA_JANELA_DIAS),
  };
}

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
    setForm({
      valor_projetado: pagamento.valor_projetado,
      data_vencimento: pagamento.data_vencimento ?? undefined,
    });
  }

  function cancelarEdicao() {
    setEditId(null);
    setForm({});
  }

  async function salvar(pagamento: PagamentoProjetado) {
    if (!form.valor_projetado || form.valor_projetado <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    const editandoData = pagamento.status === "PROJETADO";
    const novaData = form.data_vencimento;
    const dataMudou = editandoData && novaData && novaData !== pagamento.data_vencimento;

    if (dataMudou) {
      if (novaData < hojeISO()) {
        toast.error("Data de Vencimento não pode ser no passado");
        return;
      }
      const janela = calcularJanela(pagamentos, pagamento.contrato_id, pagamento.id);
      if (janela && (novaData < janela.min || novaData > janela.max)) {
        toast.error(
          `Data fora da janela deste contrato (esperado entre ${formatDate(janela.min)} e ${formatDate(janela.max)})`
        );
        return;
      }
      const confirmou = window.confirm(
        `Deseja alterar o vencimento de ${formatBRL(form.valor_projetado)} de ${formatDate(
          pagamento.data_vencimento
        )} para ${formatDate(novaData)}?`
      );
      if (!confirmou) return;
    }

    const payload: AtualizarPagamentoPayload = {
      valor_projetado: form.valor_projetado,
      ...(dataMudou ? { data_vencimento: novaData } : {}),
    };

    try {
      await atualizar.mutateAsync({ id: pagamento.id, payload });
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
            const editavel = pagamento.status === "PROJETADO";
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

                <TableCell>
                  {emEdicao && editavel ? (
                    <Input
                      type="date"
                      className="w-36"
                      value={form.data_vencimento ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, data_vencimento: e.target.value }))}
                    />
                  ) : emEdicao ? (
                    <span
                      className="inline-flex items-center gap-1.5 text-muted-foreground"
                      title="Não é possível alterar pagamentos já registrados (pago/atrasado)"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      {formatDate(pagamento.data_vencimento)}
                    </span>
                  ) : (
                    formatDate(pagamento.data_vencimento)
                  )}
                </TableCell>

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
                        onClick={() => salvar(pagamento)}
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
