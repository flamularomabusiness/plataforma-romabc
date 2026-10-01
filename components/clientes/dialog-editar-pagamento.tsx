"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAtualizarPagamento } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import { STATUS_PAGAMENTO, type PagamentoProjetado, type StatusPagamento } from "@/lib/types";
import { maskCurrencyToNumber, formatCurrencyInput } from "@/lib/masks";

const STATUS_LABELS: Record<StatusPagamento, string> = {
  PROJETADO: "Projetado",
  PAGO: "Pago",
  ATRASADO: "Atrasado",
  INADIMPLENTE: "Inadimplente",
  CANCELADO: "Cancelado",
};

/** Hoje em "YYYY-MM-DD" — usado como data_pagamento_real ao marcar PAGO por aqui. */
function hojeISO(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(
    hoje.getDate()
  ).padStart(2, "0")}`;
}

/**
 * Edição rápida (valor + status) direto na tela de visualização do cliente —
 * não mexe em data de vencimento/forma de pagamento (isso continua na tela
 * de edição, components/clientes/tabela-pagamentos-editavel.tsx). Zerar o
 * valor é aceito de propósito (desconto/não será cobrado, sem apagar a
 * linha) — diferente de marcar CANCELADO, que também mantém o valor
 * original no histórico, só para de contar em qualquer projeção de receita.
 */
export function DialogEditarPagamento({
  pagamento,
  clienteId,
}: {
  pagamento: PagamentoProjetado;
  clienteId: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(pagamento.valor_projetado);
  const [status, setStatus] = useState<StatusPagamento>(pagamento.status);
  const atualizar = useAtualizarPagamento(clienteId);

  function abrir() {
    setValor(pagamento.valor_projetado);
    setStatus(pagamento.status);
    setAberto(true);
  }

  async function salvar() {
    if (valor === null || valor === undefined || Number.isNaN(valor) || valor < 0) {
      toast.error("Informe um valor válido (0 ou maior)");
      return;
    }

    try {
      await atualizar.mutateAsync({
        id: pagamento.id,
        payload: {
          valor_projetado: valor,
          status,
          data_pagamento_real: status === "PAGO" ? pagamento.data_pagamento_real ?? hojeISO() : null,
        },
      });
      toast.success("Parcela atualizada com sucesso!");
      setAberto(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar parcela");
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <Button size="icon" variant="ghost" onClick={abrir} aria-label="Editar parcela">
        <Pencil className="h-4 w-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Parcela</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Data Vencimento</label>
            <p className="font-medium">{formatDate(pagamento.data_vencimento)}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Valor</label>
            <Input
              value={valor ? formatCurrencyInput(valor) : ""}
              onChange={(e) => setValor(maskCurrencyToNumber(e.target.value))}
              placeholder="R$ 0,00"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusPagamento)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_PAGAMENTO.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAberto(false)} disabled={atualizar.isPending}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={atualizar.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
