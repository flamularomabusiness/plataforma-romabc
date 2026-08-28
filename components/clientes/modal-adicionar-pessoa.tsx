"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { maskCPF, maskPhone } from "@/lib/masks";
import { useAdicionarPessoaCliente, useContratosDoCliente } from "@/lib/queries";
import { FUNCOES_PESSOA } from "@/lib/types";

const FUNCAO_LABELS: Record<(typeof FUNCOES_PESSOA)[number], string> = {
  DONO: "Dono",
  FINANCEIRO: "Financeiro",
  SOCIO: "Sócio",
  OUTRO: "Outros",
};

const pessoaModalSchema = z.object({
  contratoId: z.string().optional(),
  cpf: z
    .string()
    .min(1, "CPF é obrigatório")
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido"),
  nome_completo: z.string().min(1, "Nome completo é obrigatório"),
  telefone: z
    .string()
    .min(1, "Telefone é obrigatório")
    .regex(/^\(\d{2}\) \d{4,5}-\d{4}$/, "Telefone inválido"),
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  data_nascimento: z.string().min(1, "Data de nascimento é obrigatória"),
  rede_social: z.string().optional().or(z.literal("")),
  funcao: z.enum(FUNCOES_PESSOA, { errorMap: () => ({ message: "Selecione uma função" }) }),
  eh_principal: z.boolean(),
});

type PessoaModalValues = z.infer<typeof pessoaModalSchema>;

const valoresPadrao: PessoaModalValues = {
  contratoId: "",
  cpf: "",
  nome_completo: "",
  telefone: "",
  email: "",
  data_nascimento: "",
  rede_social: "",
  funcao: "DONO",
  eh_principal: false,
};

export function ModalAdicionarPessoa({
  cliente,
  open,
  onOpenChange,
}: {
  cliente: { id: string; nome_razao_social: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: contratos, isLoading: carregandoContratos } = useContratosDoCliente(
    open ? cliente?.id ?? null : null
  );
  const adicionar = useAdicionarPessoaCliente();

  const form = useForm<PessoaModalValues>({
    resolver: zodResolver(pessoaModalSchema),
    defaultValues: valoresPadrao,
    mode: "onTouched",
  });

  useEffect(() => {
    if (open) {
      form.reset(valoresPadrao);
    }
  }, [open, cliente?.id, form]);

  useEffect(() => {
    if (contratos && contratos.length === 1) {
      form.setValue("contratoId", contratos[0].id);
    }
  }, [contratos, form]);

  function onInvalid(errors: Record<string, { message?: string } | undefined>) {
    const primeiraMensagem = Object.values(errors)[0]?.message;
    toast.error(primeiraMensagem ?? "Verifique os campos obrigatórios.");
  }

  async function onSubmit(values: PessoaModalValues) {
    const contratoId = multiplosContratos ? values.contratoId : contratos?.[0]?.id;
    if (!contratoId) {
      form.setError("contratoId", { message: "Selecione o contrato" });
      return;
    }
    try {
      await adicionar.mutateAsync({
        contratoId,
        payload: {
          cpf: values.cpf,
          nome_completo: values.nome_completo,
          telefone: values.telefone,
          email: values.email,
          data_nascimento: values.data_nascimento,
          rede_social: values.rede_social || null,
          funcao: values.funcao,
          eh_principal: values.eh_principal,
        },
      });
      toast.success("Pessoa adicionada com sucesso!");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar pessoa");
    }
  }

  const semContrato = !carregandoContratos && (contratos ?? []).length === 0;
  const multiplosContratos = (contratos ?? []).length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Pessoa{cliente ? ` — ${cliente.nome_razao_social}` : ""}</DialogTitle>
        </DialogHeader>

        {carregandoContratos ? (
          <Skeleton className="h-64 w-full" />
        ) : semContrato ? (
          <div className="space-y-4 py-4 text-center">
            <p className="text-muted-foreground">
              Este cliente ainda não tem contrato — cadastre um contrato antes de adicionar uma pessoa.
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4">
              {multiplosContratos && (
                <FormField
                  control={form.control}
                  name="contratoId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contrato *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o contrato" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(contratos ?? []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.produto_nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="000.000.000-00"
                        value={field.value}
                        onChange={(e) => field.onChange(maskCPF(e.target.value))}
                        maxLength={14}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nome_completo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="(00) 00000-0000"
                        value={field.value}
                        onChange={(e) => field.onChange(maskPhone(e.target.value))}
                        maxLength={15}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_nascimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Nascimento *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rede_social"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rede Social</FormLabel>
                    <FormControl>
                      <Input placeholder="LinkedIn, Instagram, etc" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="funcao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Função *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FUNCOES_PESSOA.map((funcao) => (
                          <SelectItem key={funcao} value={funcao}>
                            {FUNCAO_LABELS[funcao]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="eh_principal"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                    </FormControl>
                    <FormLabel className="!mt-0">☆ Marcar como Principal</FormLabel>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={adicionar.isPending}>
                  {adicionar.isPending ? "Salvando..." : "Salvar Pessoa"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
