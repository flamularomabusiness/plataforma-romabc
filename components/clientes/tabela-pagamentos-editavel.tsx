"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Pencil, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useAtualizarPagamento, type AtualizarPagamentoPayload } from "@/lib/queries";
import { formatBRL, formatDate } from "@/lib/utils";
import type { PagamentoProjetado, StatusPagamento } from "@/lib/types";
import { maskCurrencyToNumber, formatCurrencyInput } from "@/lib/masks";

const STATUS_PAGAMENTO_EDITAVEL: StatusPagamento[] = ["projetado", "pago", "atrasado", "cancelado"];

const STATUS_PAGAMENTO_LABEL: Record<StatusPagamento, string> = {
  projetado: "Projetado",
  pago: "Pago",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
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

export function TabelaPagamentosEditavel({
  pagamentos,
  clienteId,
}: {
  pagamentos: PagamentoProjetado[];
  clienteId: string;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AtualizarPagamentoPayload>({});
  const atualizar = useAtualizarPagamento(clienteId);

  function iniciarEdicao(pagamento: PagamentoProjetado) {
    setEditId(pagamento.id);
    setForm({
      valor_projetado: pagamento.valor_projetado,
      status: pagamento.status,
      data_pagamento_real: pagamento.data_pagamento_real,
    });
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
    if (form.status === "pago" && !form.data_pagamento_real) {
      toast.error("Informe a data do pagamento");
      return;
    }

    try {
      await atualizar.mutateAsync({
        id,
        payload: {
          ...form,
          data_pagamento_real: form.status === "pago" ? form.data_pagamento_real : null,
        },
      });
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
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              Nenhum pagamento projetado.
            </TableCell>
          </TableRow>
        ) : (
          pagamentos.map((pagamento) => {
            const emEdicao = editId === pagamento.id;
            return (
              <TableRow key={pagamento.id}>
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
                  {emEdicao ? (
                    <Select
                      value={form.status}
                      onValueChange={(v) => setForm((f) => ({ ...f, status: v as StatusPagamento }))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_PAGAMENTO_EDITAVEL.map((status) => (
                          <SelectItem key={status} value={status}>
                            {STATUS_PAGAMENTO_LABEL[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={STATUS_PAGAMENTO_VARIANT[pagamento.status]}>
                      {STATUS_PAGAMENTO_LABEL[pagamento.status]}
                    </Badge>
                  )}
                </TableCell>

                <TableCell>
                  {emEdicao ? (
                    form.status === "pago" && (
                      <Input
                        type="date"
                        className="w-40"
                        value={form.data_pagamento_real ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, data_pagamento_real: e.target.value }))
                        }
                      />
                    )
                  ) : (
                    formatDate(pagamento.data_pagamento_real)
                  )}
                </TableCell>

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
