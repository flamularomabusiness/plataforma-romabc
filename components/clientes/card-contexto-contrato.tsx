"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAtualizarContrato } from "@/lib/queries";

export function CardContextoContrato({
  contratoId,
  clienteId,
  produtoNome,
  contextoAtual,
}: {
  contratoId: string;
  clienteId: string;
  produtoNome: string;
  contextoAtual: string;
}) {
  const [emEdicao, setEmEdicao] = useState(false);
  const [texto, setTexto] = useState(contextoAtual);
  const atualizar = useAtualizarContrato(clienteId);

  function iniciarEdicao() {
    setTexto(contextoAtual);
    setEmEdicao(true);
  }

  function cancelarEdicao() {
    setTexto(contextoAtual);
    setEmEdicao(false);
  }

  async function salvar() {
    try {
      await atualizar.mutateAsync({
        id: contratoId,
        payload: { contexto_perfil_cliente: texto },
      });
      toast.success("Contexto atualizado com sucesso!");
      setEmEdicao(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar contexto");
    }
  }

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{produtoNome}</p>
        {!emEdicao && (
          <Button size="sm" variant="outline" onClick={iniciarEdicao}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Editar
          </Button>
        )}
      </div>

      {emEdicao ? (
        <div className="space-y-2">
          <Textarea
            className="h-40"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Contexto e perfil do cliente/empresa..."
          />
          <div className="flex justify-end gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={salvar}
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
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm">
          {contextoAtual || <span className="text-muted-foreground">Nenhum contexto preenchido.</span>}
        </p>
      )}
    </div>
  );
}
