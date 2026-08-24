"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAtualizarCliente } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import { maskCNPJ, maskPhone } from "@/lib/masks";
import type { Cliente } from "@/lib/types";

const dadosCadastraisSchema = z.object({
  nome_razao_social: z.string().min(1, "Nome/Razão Social é obrigatório"),
  cpf_cnpj_responsavel: z
    .string()
    .min(1, "CPF/CNPJ é obrigatório")
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, "CNPJ inválido"),
  email_responsavel: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  telefone_responsavel: z.string().optional().or(z.literal("")),
  data_nascimento_responsavel: z.string().optional().or(z.literal("")),
  rede_social_responsavel: z.string().optional().or(z.literal("")),
});

type DadosCadastraisValues = z.infer<typeof dadosCadastraisSchema>;

function paraValoresFormulario(cliente: Cliente): DadosCadastraisValues {
  return {
    nome_razao_social: cliente.nome_razao_social,
    cpf_cnpj_responsavel: cliente.cpf_cnpj_responsavel,
    email_responsavel: cliente.email_responsavel ?? "",
    telefone_responsavel: cliente.telefone_responsavel ?? "",
    data_nascimento_responsavel: cliente.data_nascimento_responsavel ?? "",
    rede_social_responsavel: cliente.rede_social_responsavel ?? "",
  };
}

export function FormDadosCadastrais({ cliente }: { cliente: Cliente }) {
  const [editando, setEditando] = useState(false);
  const atualizar = useAtualizarCliente(cliente.id);

  const form = useForm<DadosCadastraisValues>({
    resolver: zodResolver(dadosCadastraisSchema),
    defaultValues: paraValoresFormulario(cliente),
  });

  useEffect(() => {
    if (!editando) form.reset(paraValoresFormulario(cliente));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente, editando]);

  async function onSubmit(values: DadosCadastraisValues) {
    try {
      await atualizar.mutateAsync({
        nome_razao_social: values.nome_razao_social,
        cpf_cnpj_responsavel: values.cpf_cnpj_responsavel,
        email_responsavel: values.email_responsavel,
        telefone_responsavel: values.telefone_responsavel || null,
        data_nascimento_responsavel: values.data_nascimento_responsavel || null,
        rede_social_responsavel: values.rede_social_responsavel || null,
      });
      toast.success("Cliente atualizado com sucesso!");
      setEditando(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar cliente");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Dados Cadastrais</CardTitle>
        {!editando && (
          <Button size="sm" onClick={() => setEditando(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editando ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="nome_razao_social"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Nome/Razão Social *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cpf_cnpj_responsavel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF/CNPJ *</FormLabel>
                      <FormControl>
                        <Input
                          value={field.value}
                          onChange={(e) => field.onChange(maskCNPJ(e.target.value))}
                          maxLength={18}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email_responsavel"
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
                  name="telefone_responsavel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input
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
                  name="data_nascimento_responsavel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Nascimento</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rede_social_responsavel"
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
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={atualizar.isPending}>
                  Salvar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditando(false)}
                  disabled={atualizar.isPending}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Nome/Razão Social</p>
              <p className="font-medium">{cliente.nome_razao_social}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">CPF/CNPJ</p>
              <p className="font-medium">{cliente.cpf_cnpj_responsavel}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{cliente.email_responsavel ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Telefone</p>
              <p className="font-medium">{cliente.telefone_responsavel ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data Nascimento</p>
              <p className="font-medium">{formatDate(cliente.data_nascimento_responsavel)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rede Social</p>
              <p className="font-medium">{cliente.rede_social_responsavel ?? "-"}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
