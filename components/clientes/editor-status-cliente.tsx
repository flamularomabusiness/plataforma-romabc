"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Lightbulb } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { podeAcessar, useUserRole } from "@/lib/auth";
import { useAtualizarStatusCliente } from "@/lib/queries";
import { calcularStatusSugerido } from "@/lib/status-helper";
import { STATUS_CLIENTE, type ClienteDetalhes, type StatusCliente } from "@/lib/types";

const STATUS_LABELS: Record<StatusCliente, string> = {
  ATIVO: "ATIVO",
  INATIVO: "INATIVO",
  INADIMPLENTE: "INADIMPLENTE",
};

export function EditorStatusCliente({ cliente }: { cliente: ClienteDetalhes }) {
  const userRole = useUserRole();
  const podeEditar = podeAcessar(userRole, "editarStatusCliente");
  const [novoStatus, setNovoStatus] = useState<StatusCliente>(cliente.status);
  const atualizar = useAtualizarStatusCliente(cliente.id);

  const sugestao = calcularStatusSugerido(cliente.pagamentos_projetados);

  async function salvar() {
    const confirmou = window.confirm(
      `Alterar o status de ${cliente.nome_razao_social} para ${STATUS_LABELS[novoStatus]}?`
    );
    if (!confirmou) return;

    try {
      await atualizar.mutateAsync(novoStatus);
      toast.success("Status atualizado com sucesso!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar status");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Status do Cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!podeEditar ? (
          <div className="flex items-center gap-3">
            <StatusBadge status={cliente.status} size="lg" />
            <p className="text-sm text-muted-foreground">
              Apenas Gerente e Financeiro podem alterar o status.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={novoStatus}
                onValueChange={(v) => setNovoStatus(v as StatusCliente)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_CLIENTE.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={salvar}
                disabled={atualizar.isPending || novoStatus === cliente.status}
              >
                Salvar
              </Button>
            </div>

            {sugestao !== cliente.status && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Lightbulb className="h-3.5 w-3.5" />
                Sugestão baseada nos pagamentos: {STATUS_LABELS[sugestao]}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
