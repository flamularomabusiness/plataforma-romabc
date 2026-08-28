"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Pencil, Star, X } from "lucide-react";

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
import { useAtualizarPessoa, type AtualizarPessoaPayload } from "@/lib/queries";
import { maskCPF, maskPhone } from "@/lib/masks";
import { FUNCOES_PESSOA, type PessoaCliente } from "@/lib/types";
import { cn } from "@/lib/utils";

const FUNCAO_LABELS: Record<string, string> = {
  DONO: "Dono",
  FINANCEIRO: "Financeiro",
  SOCIO: "Sócio",
  OUTRO: "Outros",
};

export function TabelaPessoasEditavel({
  pessoas,
  clienteId,
}: {
  pessoas: PessoaCliente[];
  clienteId: string;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AtualizarPessoaPayload>({});
  const atualizar = useAtualizarPessoa(clienteId);

  function iniciarEdicao(pessoa: PessoaCliente) {
    setEditId(pessoa.id);
    setForm({
      cpf: pessoa.cpf,
      nome_completo: pessoa.nome_completo,
      faturamento_medio: pessoa.faturamento_medio ?? 0,
      telefone: pessoa.telefone,
      email: pessoa.email,
      data_nascimento: pessoa.data_nascimento ?? "",
      rede_social: pessoa.rede_social ?? "",
      funcao: pessoa.funcao,
      eh_principal: pessoa.eh_principal,
    });
  }

  function cancelarEdicao() {
    setEditId(null);
    setForm({});
  }

  async function salvar(pessoa: PessoaCliente) {
    if (!form.nome_completo?.trim()) {
      toast.error("Informe o nome completo");
      return;
    }
    if (!form.email?.trim()) {
      toast.error("Informe o e-mail");
      return;
    }

    try {
      await atualizar.mutateAsync({ id: pessoa.id, contratoId: pessoa.contrato_id, payload: form });
      toast.success("Pessoa atualizada com sucesso!");
      cancelarEdicao();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar pessoa");
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome Completo</TableHead>
          <TableHead>CPF</TableHead>
          <TableHead>Telefone</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Função</TableHead>
          <TableHead>Principal</TableHead>
          <TableHead className="text-right">Ação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pessoas.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground">
              Nenhuma pessoa cadastrada.
            </TableCell>
          </TableRow>
        ) : (
          pessoas.map((pessoa) => {
            const emEdicao = editId === pessoa.id;
            return (
              <TableRow key={pessoa.id}>
                <TableCell className="font-medium">
                  {emEdicao ? (
                    <Input
                      className="w-40"
                      value={form.nome_completo ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, nome_completo: e.target.value }))}
                    />
                  ) : (
                    pessoa.nome_completo
                  )}
                </TableCell>

                <TableCell>
                  {emEdicao ? (
                    <Input
                      className="w-32"
                      value={form.cpf ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, cpf: maskCPF(e.target.value) }))}
                      maxLength={14}
                    />
                  ) : (
                    pessoa.cpf
                  )}
                </TableCell>

                <TableCell>
                  {emEdicao ? (
                    <Input
                      className="w-32"
                      value={form.telefone ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, telefone: maskPhone(e.target.value) }))
                      }
                      maxLength={15}
                    />
                  ) : (
                    pessoa.telefone
                  )}
                </TableCell>

                <TableCell>
                  {emEdicao ? (
                    <Input
                      className="w-40"
                      type="email"
                      value={form.email ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  ) : (
                    pessoa.email
                  )}
                </TableCell>

                <TableCell>
                  {emEdicao ? (
                    <Select
                      value={form.funcao}
                      onValueChange={(v) => setForm((f) => ({ ...f, funcao: v as typeof f.funcao }))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FUNCOES_PESSOA.map((f) => (
                          <SelectItem key={f} value={f}>
                            {FUNCAO_LABELS[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    FUNCAO_LABELS[pessoa.funcao]
                  )}
                </TableCell>

                <TableCell>
                  {emEdicao ? (
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, eh_principal: !f.eh_principal }))}
                      className={cn(
                        "rounded-md border p-1.5",
                        form.eh_principal ? "border-primary bg-accent" : "border-input"
                      )}
                      aria-label="Marcar como principal"
                    >
                      <Star
                        className={cn(
                          "h-4 w-4",
                          form.eh_principal ? "fill-primary text-primary" : "text-muted-foreground"
                        )}
                      />
                    </button>
                  ) : (
                    pessoa.eh_principal && <Star className="h-4 w-4 fill-primary text-primary" />
                  )}
                </TableCell>

                <TableCell className="text-right">
                  {emEdicao ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => salvar(pessoa)}
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
                    <Button size="sm" variant="outline" onClick={() => iniciarEdicao(pessoa)}>
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
