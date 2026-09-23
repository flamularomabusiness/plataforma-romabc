"use client";

import { useEffect } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { maskCurrencyToNumber, formatCurrencyInput } from "@/lib/masks";
import { formatBRL } from "@/lib/utils";
import { FORMAS_PAGAMENTO, TIPOS_ENTRADA, type FormaPagamento, type TipoEntrada } from "@/lib/types";
import type { FormularioContratoValues } from "./form-schema";

const TIPO_ENTRADA_LABELS: Record<TipoEntrada, string> = {
  a_vista: "À Vista",
  parcelado: "Parcelado (até 5x)",
};

const FORMA_PAGAMENTO_LABELS: Record<FormaPagamento, string> = {
  pix: "PIX",
  boleto: "Boleto",
};

const OPCOES_PARCELAS_ENTRADA = [1, 2, 3, 4, 5];

/**
 * Entrada do Contrato — NOVO, independente do tipo_pagamento (recorrente/à
 * vista/parcelado): um valor pago à parte, além do plano normal, à vista ou
 * em até 5x, cada parcela com sua própria forma de pagamento.
 */
export function SecaoEntradaContrato() {
  const form = useFormContext<FormularioContratoValues>();
  const { fields, replace } = useFieldArray({ control: form.control, name: "entrada_parcelas" });

  const temEntrada = form.watch("tem_entrada");
  const tipoEntrada = form.watch("tipo_entrada");
  const numeroParcelasEntrada = form.watch("entrada_numero_parcelas");
  const entradaParcelas = form.watch("entrada_parcelas") ?? [];

  const alvo = tipoEntrada === "a_vista" ? 1 : tipoEntrada === "parcelado" ? numeroParcelasEntrada ?? 0 : 0;

  useEffect(() => {
    if (!temEntrada) {
      if (fields.length > 0) replace([]);
      return;
    }
    if (fields.length === alvo) return;
    const atuais = form.getValues("entrada_parcelas") ?? [];
    const novas = Array.from(
      { length: alvo },
      (_, i) => atuais[i] ?? { valor: 0, data: "", forma_pagamento: undefined as unknown as FormaPagamento }
    );
    replace(novas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temEntrada, tipoEntrada, numeroParcelasEntrada]);

  const totalEntrada = entradaParcelas.reduce((acc, p) => acc + (p?.valor ?? 0), 0);

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <FormField
        control={form.control}
        name="tem_entrada"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center gap-2 space-y-0">
            <FormControl>
              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
            <FormLabel className="!mt-0">Este contrato tem entrada?</FormLabel>
          </FormItem>
        )}
      />

      {temEntrada && (
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="tipo_entrada"
            render={({ field }) => (
              <FormItem className="max-w-xs">
                <FormLabel>Tipo de Entrada *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TIPOS_ENTRADA.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {TIPO_ENTRADA_LABELS[tipo]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {tipoEntrada === "parcelado" && (
            <FormField
              control={form.control}
              name="entrada_numero_parcelas"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel>Quantas Parcelas? *</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(Number(v))}
                    value={field.value ? String(field.value) : undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {OPCOES_PARCELAS_ENTRADA.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}x
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {(tipoEntrada === "a_vista" || tipoEntrada === "parcelado") && fields.length > 0 && (
            <div className="space-y-3">
              {fields.map((item, index) => (
                <Card key={item.id} className="border-muted-foreground/30">
                  <CardContent className="grid items-start gap-3 pt-6 sm:grid-cols-[auto_1fr_1fr_1fr]">
                    <span className="self-center text-sm font-semibold text-muted-foreground">
                      {tipoEntrada === "a_vista" ? "Entrada" : `Entrada ${index + 1} de ${fields.length}`}
                    </span>

                    <FormField
                      control={form.control}
                      name={`entrada_parcelas.${index}.valor`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="sr-only">Valor</FormLabel>
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
                      name={`entrada_parcelas.${index}.data`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="sr-only">Data</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`entrada_parcelas.${index}.forma_pagamento`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="sr-only">Forma de Pagamento</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Forma" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {FORMAS_PAGAMENTO.map((forma) => (
                                <SelectItem key={forma} value={forma}>
                                  {FORMA_PAGAMENTO_LABELS[forma]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              ))}

              <div className="flex justify-between rounded-lg border p-4 text-sm">
                <span className="text-muted-foreground">Total da Entrada</span>
                <span className="font-medium">{formatBRL(totalEntrada)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
