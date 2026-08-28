"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Star, Trash2 } from "lucide-react";

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
import { FUNCOES_PESSOA } from "@/lib/types";
import { cn } from "@/lib/utils";
import { maskCPF, maskPhone, maskCurrencyToNumber, formatCurrencyInput } from "@/lib/masks";
import { pessoaVazia, type FormularioContratoValues } from "./form-schema";

const MAX_PESSOAS = 10;

const FUNCAO_LABELS: Record<string, string> = {
  DONO: "Dono",
  FINANCEIRO: "Financeiro",
  SOCIO: "Sócio",
  OUTRO: "Outros",
};

export function SecaoPessoaCliente() {
  const form = useFormContext<FormularioContratoValues>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "pessoas",
  });

  const pessoasError = (form.formState.errors.pessoas as { root?: { message?: string } } | undefined)
    ?.root?.message;

  function marcarComoPrincipal(indexSelecionado: number) {
    fields.forEach((_, index) => {
      form.setValue(`pessoas.${index}.eh_principal`, index === indexSelecionado, {
        shouldValidate: false,
      });
    });
    form.trigger("pessoas");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {fields.length}/{MAX_PESSOAS} pessoas adicionadas
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={fields.length >= MAX_PESSOAS}
          onClick={() => {
            append(pessoaVazia);
            form.trigger("pessoas");
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar outra pessoa
        </Button>
      </div>

      {pessoasError && (
        <p className="text-sm font-medium text-destructive">{pessoasError}</p>
      )}

      {fields.map((item, index) => {
        const ehPrincipal = form.watch(`pessoas.${index}.eh_principal`);
        return (
          <Card
            key={item.id}
            className={cn(
              "transition-colors",
              ehPrincipal ? "border-2 border-primary bg-accent" : "border-muted-foreground/30"
            )}
          >
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                  {ehPrincipal && <Star className="h-4 w-4 fill-primary text-primary" />}
                  Pessoa {index + 1}
                  {ehPrincipal && <span className="text-primary">— Principal</span>}
                </span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={fields.length <= 1}
                  onClick={() => {
                    remove(index);
                    form.trigger("pessoas");
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover
                </Button>
              </div>

              <div className="grid gap-4">
                <FormField
                  control={form.control}
                  name={`pessoas.${index}.nome_completo`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`pessoas.${index}.cpf`}
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
                  name={`pessoas.${index}.telefone`}
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
                  name={`pessoas.${index}.email`}
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
                  name={`pessoas.${index}.faturamento_medio`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Faturamento Médio *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="R$ 0,00"
                          value={formatCurrencyInput(field.value ?? 0)}
                          onChange={(e) => field.onChange(maskCurrencyToNumber(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`pessoas.${index}.data_nascimento`}
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
                  name={`pessoas.${index}.funcao`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Função *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a função" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {FUNCOES_PESSOA.map((f) => (
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

                <FormField
                  control={form.control}
                  name={`pessoas.${index}.rede_social`}
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

              <button
                type="button"
                onClick={() => marcarComoPrincipal(index)}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                  ehPrincipal
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-muted-foreground hover:bg-accent"
                )}
              >
                <Star className={cn("h-4 w-4", ehPrincipal && "fill-current")} />
                {ehPrincipal ? "Marcada como Principal" : "Marcar como Principal"}
              </button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
