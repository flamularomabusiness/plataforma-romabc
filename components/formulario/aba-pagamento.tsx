"use client";

import { useEffect } from "react";
import { useFormContext } from "react-hook-form";

import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLANOS } from "@/lib/types";
import { maskCurrencyToNumber, formatCurrencyInput } from "@/lib/masks";
import type { FormularioContratoValues } from "./form-schema";

export function AbaPagamento() {
  const form = useFormContext<FormularioContratoValues>();
  const valorMensal = form.watch("valor_mensal");
  const valorPrimeiroPagamento = form.watch("valor_primeiro_pagamento");

  useEffect(() => {
    if (valorPrimeiroPagamento === null || valorPrimeiroPagamento === undefined) {
      form.setValue("valor_primeiro_pagamento", valorMensal || null, {
        shouldValidate: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorMensal]);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <FormField
        control={form.control}
        name="valor_mensal"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Valor da Consultoria/Serviço *</FormLabel>
            <FormControl>
              <Input
                placeholder="R$ 0,00"
                value={field.value ? formatCurrencyInput(field.value) : ""}
                onChange={(e) => field.onChange(maskCurrencyToNumber(e.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="plano_contratado"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Plano Contratado *</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {PLANOS.map((plano) => (
                  <SelectItem key={plano} value={plano}>
                    {plano}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>Em breve: múltiplos planos com valores próprios.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="recorrente"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel>Recorrente? *</FormLabel>
              <FormDescription>{field.value ? "Sim" : "Não"}</FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="data_inicio_primeiro_pagamento"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Data do 1º Pagamento *</FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="valor_primeiro_pagamento"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Valor do 1º Pagamento</FormLabel>
            <FormControl>
              <Input
                placeholder="R$ 0,00"
                value={
                  field.value === null || field.value === undefined
                    ? ""
                    : formatCurrencyInput(field.value)
                }
                onChange={(e) => field.onChange(maskCurrencyToNumber(e.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="data_vencimento_mensal"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Dia de Vencimento das Mensalidades *</FormLabel>
            <FormControl>
              <Input
                type="number"
                min={1}
                max={31}
                value={field.value ?? ""}
                onChange={(e) => field.onChange(Number(e.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="data_inicio_consultoria"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Data de Início da Consultoria</FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="data_onboarding"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Data do Onboarding</FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
