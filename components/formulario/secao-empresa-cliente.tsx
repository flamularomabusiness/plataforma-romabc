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
import { ESTADOS_BR } from "@/lib/types";
import { maskCNPJ, maskCurrencyToNumber, formatCurrencyInput } from "@/lib/masks";
import { empresaVazia, type FormularioContratoValues } from "./form-schema";

export function SecaoEmpresaCliente() {
  const form = useFormContext<FormularioContratoValues>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "empresas",
  });

  const empresasError = (
    form.formState.errors.empresas as { root?: { message?: string } } | undefined
  )?.root?.message;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{fields.length} empresa(s) adicionada(s)</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            append(empresaVazia);
            form.trigger("empresas");
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar outra empresa
        </Button>
      </div>

      {empresasError && (
        <p className="text-sm font-medium text-destructive">{empresasError}</p>
      )}

      {fields.map((item, index) => (
        <Card key={item.id} className="border-muted-foreground/30">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">
                Empresa {index + 1}
              </span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={fields.length <= 1}
                onClick={() => {
                  remove(index);
                  form.trigger("empresas");
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remover
              </Button>
            </div>

            <FormField
              control={form.control}
              name={`empresas.${index}.nome_razao_social`}
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
              name={`empresas.${index}.cpf_cnpj_responsavel`}
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

            {/* Cidade/Estado: dois campos (texto + UF) em vez de um único
                campo livre — mapeiam direto pras colunas cidade/estado do
                banco e evitam ter que interpretar "Cidade - UF" digitado
                livremente. */}
            <div className="flex gap-3">
              <FormField
                control={form.control}
                name={`empresas.${index}.cidade`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Cidade/Estado *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: São Paulo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`empresas.${index}.estado`}
                render={({ field }) => (
                  <FormItem className="w-28 shrink-0">
                    <FormLabel className="sr-only">Estado</FormLabel>
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
              name={`empresas.${index}.faturamento_medio`}
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
