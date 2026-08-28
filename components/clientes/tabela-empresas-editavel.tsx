"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Pencil, X } from "lucide-react";

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
import {
  useAtualizarCliente,
  useRemoverEmpresaDoContrato,
  type AtualizarClientePayload,
} from "@/lib/queries";
import { formatCurrencyInput, maskCNPJ, maskCurrencyToNumber } from "@/lib/masks";
import { ESTADOS_BR, type Cliente } from "@/lib/types";

export interface LinhaEmpresa {
  contratoId: string;
  produtoNome: string;
  empresa: Cliente;
}

export function TabelaEmpresasEditavel({
  linhas,
  clienteId,
}: {
  linhas: LinhaEmpresa[];
  clienteId: string;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AtualizarClientePayload>({});
  const atualizar = useAtualizarCliente(clienteId);
  const remover = useRemoverEmpresaDoContrato(clienteId);

  function iniciarEdicao(empresa: Cliente) {
    setEditId(empresa.id);
    setForm({
      nome_razao_social: empresa.nome_razao_social,
      cpf_cnpj_responsavel: empresa.cpf_cnpj_responsavel,
      cidade: empresa.cidade,
      estado: empresa.estado,
      faturamento_medio: empresa.faturamento_medio,
    });
  }

  function cancelarEdicao() {
    setEditId(null);
    setForm({});
  }

  async function salvar(empresaId: string) {
    if (!form.nome_razao_social?.trim()) {
      toast.error("Informe a razão social");
      return;
    }
    if (!form.cpf_cnpj_responsavel?.trim()) {
      toast.error("Informe o CNPJ");
      return;
    }

    try {
      await atualizar.mutateAsync({ id: empresaId, payload: form });
      toast.success("Empresa atualizada com sucesso!");
      cancelarEdicao();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar empresa");
    }
  }

  async function desvincular(linha: LinhaEmpresa) {
    try {
      await remover.mutateAsync({ contratoId: linha.contratoId, clienteId: linha.empresa.id });
      toast.success("Empresa desvinculada do contrato");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao desvincular empresa");
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Razão Social</TableHead>
          <TableHead>CNPJ</TableHead>
          <TableHead>Cidade/UF</TableHead>
          <TableHead>Faturamento Médio</TableHead>
          <TableHead>Contrato</TableHead>
          <TableHead className="text-right">Ação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              Nenhuma empresa vinculada.
            </TableCell>
          </TableRow>
        ) : (
          linhas.map((linha) => {
            const { empresa } = linha;
            const emEdicao = editId === empresa.id;
            return (
              <TableRow key={`${linha.contratoId}-${empresa.id}`}>
                <TableCell className="font-medium">
                  {emEdicao ? (
                    <Input
                      className="w-40"
                      value={form.nome_razao_social ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, nome_razao_social: e.target.value }))
                      }
                    />
                  ) : (
                    empresa.nome_razao_social
                  )}
                </TableCell>

                <TableCell>
                  {emEdicao ? (
                    <Input
                      className="w-36"
                      value={form.cpf_cnpj_responsavel ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          cpf_cnpj_responsavel: maskCNPJ(e.target.value),
                        }))
                      }
                      maxLength={18}
                    />
                  ) : (
                    empresa.cpf_cnpj_responsavel
                  )}
                </TableCell>

                <TableCell>
                  {emEdicao ? (
                    <div className="flex gap-1">
                      <Input
                        className="w-28"
                        value={form.cidade ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))}
                      />
                      <Select
                        value={form.estado ?? ""}
                        onValueChange={(v) => setForm((f) => ({ ...f, estado: v }))}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                        <SelectContent>
                          {ESTADOS_BR.map((uf) => (
                            <SelectItem key={uf} value={uf}>
                              {uf}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    `${empresa.cidade ?? "-"}/${empresa.estado ?? "-"}`
                  )}
                </TableCell>

                <TableCell>
                  {emEdicao ? (
                    <Input
                      className="w-32"
                      value={
                        form.faturamento_medio !== null && form.faturamento_medio !== undefined
                          ? formatCurrencyInput(form.faturamento_medio)
                          : ""
                      }
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          faturamento_medio: maskCurrencyToNumber(e.target.value),
                        }))
                      }
                    />
                  ) : (
                    formatCurrencyInput(empresa.faturamento_medio ?? 0)
                  )}
                </TableCell>

                <TableCell>{linha.produtoNome}</TableCell>

                <TableCell className="text-right">
                  {emEdicao ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => salvar(empresa.id)}
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
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => iniciarEdicao(empresa)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={linhas.filter((l) => l.contratoId === linha.contratoId).length <= 1}
                        onClick={() => desvincular(linha)}
                      >
                        Remover
                      </Button>
                    </div>
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
