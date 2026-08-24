"use client";

import { useFormContext } from "react-hook-form";

import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
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
import { ESTADOS_BR } from "@/lib/types";
import { maskCNPJ, maskCurrencyToNumber, formatCurrencyInput } from "@/lib/masks";
import type { FormularioContratoValues } from "./form-schema";

export function AbaEmpresa() {
  const form = useFormContext<FormularioContratoValues>();

  return (
    <div className="grid gap-6">
      <FormField
        control={form.control}
        name="nome_razao_social"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Razão Social *</FormLabel>
            <FormControl>
              <Input placeholder="Ex: Roma BC Consultoria Ltda" {...field} />
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
            <FormLabel>CNPJ *</FormLabel>
            <FormControl>
              <Input
                placeholder="00.000.000/0000-00"
                value={field.value}
                onChange={(e) => field.onChange(maskCNPJ(e.target.value))}
                maxLength={18}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-6 sm:grid-cols-3">
        <FormField
          control={form.control}
          name="cidade"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Cidade *</FormLabel>
              <FormControl>
                <Input placeholder="Ex: São Paulo" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="estado"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Estado *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ESTADOS_BR.map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="faturamento_medio"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Faturamento Médio</FormLabel>
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
    </div>
  );
}
