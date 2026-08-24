"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FUNCOES_CONTATO } from "@/lib/types";
import { maskPhone } from "@/lib/masks";
import { contatoVazio, type FormularioContratoValues } from "./form-schema";

const MAX_CONTATOS = 10;

const FUNCAO_LABELS: Record<string, string> = {
  RESPONSAVEL: "Responsável",
  FINANCEIRO: "Financeiro",
  SOCIO: "Sócio",
  DONO: "Dono",
  FUNCIONARIO: "Funcionário",
  OUTRO: "Outro",
};

export function AbaContatos() {
  const form = useFormContext<FormularioContratoValues>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "contatos",
  });

  const contatosError = (form.formState.errors.contatos as { root?: { message?: string } } | undefined)
    ?.root?.message;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {fields.length}/{MAX_CONTATOS} contatos adicionados
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={fields.length >= MAX_CONTATOS}
          onClick={() => {
            append(contatoVazio);
            form.trigger("contatos");
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Contato
        </Button>
      </div>

      {contatosError && (
        <p className="text-sm font-medium text-destructive">{contatosError}</p>
      )}

      {fields.map((item, index) => {
        const funcao = form.watch(`contatos.${index}.funcao`);
        return (
          <Card key={item.id} className="border-muted-foreground/30">
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">
                  Contato {index + 1}
                </span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={fields.length <= 1}
                  onClick={() => {
                    remove(index);
                    form.trigger("contatos");
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name={`contatos.${index}.nome`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`contatos.${index}.telefone`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(11) 99999-9999"
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
                  name={`contatos.${index}.email`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@empresa.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`contatos.${index}.funcao`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Função *</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          // Refinamento de "único RESPONSAVEL" é validado no nível do
                          // array; um onChange isolado do RHF não recalcula esse
                          // erro cruzado, então forçamos a revalidação do array.
                          form.trigger("contatos");
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a função" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {FUNCOES_CONTATO.map((f) => (
                            <SelectItem key={f} value={f}>
                              {FUNCAO_LABELS[f]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {funcao === "OUTRO" && (
                  <FormField
                    control={form.control}
                    name={`contatos.${index}.descricao_outro`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição (Outro)</FormLabel>
                        <FormControl>
                          <Input placeholder="Descreva a função" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name={`contatos.${index}.rede_social`}
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
                  name={`contatos.${index}.data_nascimento`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Nascimento</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
