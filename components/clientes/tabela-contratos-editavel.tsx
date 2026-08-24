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
import { useAtualizarContrato, type AtualizarContratoPayload } from "@/lib/queries";
import {
  formatBRL,
  getGrauDificuldadeBadgeVariant,
  GRAU_DIFICULDADE_LABELS,
} from "@/lib/utils";
import { GRAUS_DIFICULDADE, type ClienteDetalhes, type StatusContrato } from "@/lib/types";
import { maskCurrencyToNumber, formatCurrencyInput } from "@/lib/masks";

type Contrato = ClienteDetalhes["contratos"][number];

const STATUS_CONTRATO_EDITAVEL: StatusContrato[] = ["ativo", "cancelado"];

const STATUS_CONTRATO_LABEL: Record<StatusContrato, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  cancelado: "Cancelado",
};

const STATUS_CONTRATO_VARIANT: Record<StatusContrato, "success" | "secondary" | "destructive"> = {
  ativo: "success",
  inativo: "secondary",
  cancelado: "destructive",
};

export function TabelaContratosEditavel({
  contratos,
  clienteId,
}: {
  contratos: Contrato[];
  clienteId: string;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AtualizarContratoPayload>({});
  const atualizar = useAtualizarContrato(clienteId);

  function iniciarEdicao(contrato: Contrato) {
    setEditId(contrato.id);
    setForm({
      valor_mensal: contrato.valor_mensal,
      data_vencimento_mensal: contrato.data_vencimento_mensal,
      grau_dificuldade: contrato.grau_dificuldade,
      status: contrato.status === "inativo" ? "ativo" : contrato.status,
    });
  }

  function cancelarEdicao() {
    setEditId(null);
    setForm({});
  }

  async function salvar(id: string) {
    if (!form.valor_mensal || form.valor_mensal <= 0) {
      toast.error("Informe um valor mensal válido");
      return;
    }
    if (
      !form.data_vencimento_mensal ||
      form.data_vencimento_mensal < 1 ||
      form.data_vencimento_mensal > 31
    ) {
      toast.error("Dia de vencimento deve estar entre 1 e 31");
      return;
    }

    try {
      await atualizar.mutateAsync({ id, payload: form });
      toast.success("Contrato atualizado com sucesso!");
      cancelarEdicao();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar contrato");
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead>Valor Mensal</TableHead>
          <TableHead>Dia Vencimento</TableHead>
          <TableHead>Grau de Dificuldade</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contratos.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              Nenhum contrato cadastrado.
            </TableCell>
          </TableRow>
        ) : (
          contratos.map((contrato) => {
            const emEdicao = editId === contrato.id;
            return (
              <TableRow key={contrato.id}>
                <TableCell className="font-medium">{contrato.produto?.nome ?? "-"}</TableCell>

                <TableCell>
                  {emEdicao ? (
                    <Input
                      className="w-32"
                      value={form.valor_mensal ? formatCurrencyInput(form.valor_mensal) : ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          valor_mensal: maskCurrencyToNumber(e.target.value),
                        }))
                      }
                    />
                  ) : (
                    formatBRL(contrato.valor_mensal)
                  )}
                </TableCell>

                <TableCell>
                  {emEdicao ? (
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      className="w-20"
                      value={form.data_vencimento_mensal ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          data_vencimento_mensal: Number(e.target.value),
                        }))
                      }
                    />
                  ) : (
                    contrato.data_vencimento_mensal
                  )}
                </TableCell>

                <TableCell>
                  {emEdicao ? (
                    <Select
                      value={form.grau_dificuldade}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, grau_dificuldade: v as typeof f.grau_dificuldade }))
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GRAUS_DIFICULDADE.map((grau) => (
                          <SelectItem key={grau} value={grau}>
                            {GRAU_DIFICULDADE_LABELS[grau]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={getGrauDificuldadeBadgeVariant(contrato.grau_dificuldade)}>
                      {GRAU_DIFICULDADE_LABELS[contrato.grau_dificuldade]}
                    </Badge>
                  )}
                </TableCell>

                <TableCell>
                  {emEdicao ? (
                    <Select
                      value={form.status}
                      onValueChange={(v) => setForm((f) => ({ ...f, status: v as typeof f.status }))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_CONTRATO_EDITAVEL.map((status) => (
                          <SelectItem key={status} value={status}>
                            {STATUS_CONTRATO_LABEL[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={STATUS_CONTRATO_VARIANT[contrato.status]}>
                      {STATUS_CONTRATO_LABEL[contrato.status]}
                    </Badge>
                  )}
                </TableCell>

                <TableCell className="text-right">
                  {emEdicao ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => salvar(contrato.id)}
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
                    <Button size="sm" variant="outline" onClick={() => iniciarEdicao(contrato)}>
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
