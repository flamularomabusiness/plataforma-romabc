"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, EyeOff, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeletarClienteHard, useDeletarClienteSoft } from "@/lib/queries";
import { useUserRole } from "@/lib/auth";

export function DialogDeletarCliente({
  cliente,
  open,
  onOpenChange,
}: {
  cliente: { id: string; nome_razao_social: string; cpf_cnpj_responsavel: string; contratos_count: number } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const userRole = useUserRole();
  const ehAdministrator = userRole === "administrator";
  const [erroHard, setErroHard] = useState<string | null>(null);

  const soft = useDeletarClienteSoft();
  const hard = useDeletarClienteHard();

  function fechar() {
    setErroHard(null);
    onOpenChange(false);
  }

  async function ocultar() {
    if (!cliente) return;
    try {
      await soft.mutateAsync({ clienteId: cliente.id });
      toast.success("Cliente ocultado — pode ser restaurado por um Administrador.");
      fechar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao ocultar cliente");
    }
  }

  async function apagarPermanente() {
    if (!cliente) return;
    setErroHard(null);
    try {
      await hard.mutateAsync({ clienteId: cliente.id });
      toast.success("Cliente apagado permanentemente.");
      fechar();
    } catch (error) {
      // Fica no modal em vez de fechar — a mensagem da RPC já explica o
      // motivo (histórico financeiro real ou contrato compartilhado) e
      // oferece o botão "Ocultar" logo abaixo como alternativa.
      setErroHard(error instanceof Error ? error.message : "Erro ao apagar cliente");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : fechar())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deletar Cliente</DialogTitle>
          {cliente && (
            <DialogDescription>
              {cliente.nome_razao_social} — {cliente.cpf_cnpj_responsavel}
              {cliente.contratos_count > 0 && ` · ${cliente.contratos_count} contrato(s)`}
            </DialogDescription>
          )}
        </DialogHeader>

        {erroHard && (
          <div className="flex gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{erroHard}</span>
          </div>
        )}

        {ehAdministrator ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Como Administrador, você pode ocultar (reversível) ou apagar de verdade. Apagar de
              verdade só é permitido se este cliente não tiver pagamentos já pagos/atrasados e não
              tiver contrato compartilhado com outra empresa.
            </p>
            <div className="rounded-md border p-3 text-sm">
              <strong className="text-destructive">Apagar Permanentemente</strong>
              <p className="mt-1 text-muted-foreground">
                Remove o cliente, contratos e pagamentos do banco de dados. Não pode ser desfeito.
              </p>
            </div>
            <div className="rounded-md border p-3 text-sm">
              <strong>Ocultar</strong>
              <p className="mt-1 text-muted-foreground">
                Some da listagem, mas pode ser restaurado por um Administrador a qualquer momento.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Certeza? O cliente será ocultado da listagem, mas poderá ser restaurado por um
            Administrador — não é uma ação permanente.
          </p>
        )}

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" onClick={fechar}>
            Cancelar
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              onClick={ocultar}
              disabled={soft.isPending || hard.isPending}
            >
              <EyeOff className="mr-2 h-4 w-4" />
              {soft.isPending ? "Ocultando..." : "Ocultar"}
            </Button>
            {ehAdministrator && (
              <Button
                type="button"
                variant="destructive"
                onClick={apagarPermanente}
                disabled={soft.isPending || hard.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {hard.isPending ? "Apagando..." : "Apagar Permanentemente"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
