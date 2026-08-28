"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAtualizarPagamento, type AtualizarPagamentoPayload } from "@/lib/queries";
import { STATUS_PAGAMENTO, type StatusPagamento } from "@/lib/types";

const STATUS_LABELS: Record<StatusPagamento, string> = {
  PROJETADO: "Projetado",
  PAGO: "Pago",
  ATRASADO: "Atrasado",
  INADIMPLENTE: "Inadimplente",
};

/** Hoje no formato "YYYY-MM-DD", pra usar como default do campo Data Pagamento. */
function hojeISO(): string {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${hoje.getFullYear()}-${mes}-${dia}`;
}

export function PagamentoStatusDropdown({
  pagamentoId,
  statusAtual,
  dataPagamentoAtual,
  clienteId,
}: {
  pagamentoId: string;
  statusAtual: StatusPagamento;
  dataPagamentoAtual: string | null;
  clienteId: string;
}) {
  const atualizar = useAtualizarPagamento(clienteId);
  const [status, setStatus] = useState<StatusPagamento>(statusAtual);
  const [dataPagamento, setDataPagamento] = useState(dataPagamentoAtual ?? "");

  // Sincroniza com o servidor quando os dados do cliente são recarregados
  // (ex.: outro campo da mesma linha foi editado e invalidou a query).
  useEffect(() => {
    setStatus(statusAtual);
    setDataPagamento(dataPagamentoAtual ?? "");
  }, [statusAtual, dataPagamentoAtual]);

  async function salvar(payload: AtualizarPagamentoPayload) {
    try {
      await atualizar.mutateAsync({ id: pagamentoId, payload });
      toast.success("Pagamento atualizado!");
    } catch (error) {
      // Reverte a UI otimista se a gravação falhar.
      setStatus(statusAtual);
      setDataPagamento(dataPagamentoAtual ?? "");
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar pagamento");
    }
  }

  function mudarStatus(novoStatus: StatusPagamento) {
    setStatus(novoStatus);
    if (novoStatus === "PAGO") {
      const data = dataPagamento || hojeISO();
      setDataPagamento(data);
      salvar({ status: novoStatus, data_pagamento_real: data });
    } else {
      setDataPagamento("");
      salvar({ status: novoStatus, data_pagamento_real: null });
    }
  }

  function mudarDataPagamento(novaData: string) {
    setDataPagamento(novaData);
    salvar({ status: "PAGO", data_pagamento_real: novaData || null });
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={status}
        onValueChange={(v) => mudarStatus(v as StatusPagamento)}
        disabled={atualizar.isPending}
      >
        <SelectTrigger className="w-36">
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

      {atualizar.isPending && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}

      {status === "PAGO" && (
        <Input
          type="date"
          className="w-36"
          value={dataPagamento}
          onChange={(e) => mudarDataPagamento(e.target.value)}
          disabled={atualizar.isPending}
        />
      )}
    </div>
  );
}
