"use client";

import { useEffect } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Check, X } from "lucide-react";

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
import { maskCurrencyToNumber, formatCurrencyInput } from "@/lib/masks";
import { cn, formatBRL } from "@/lib/utils";
import { FORMAS_PAGAMENTO, type FormaPagamento } from "@/lib/types";
import type { FormularioContratoValues } from "./form-schema";

const FORMA_PAGAMENTO_LABELS: Record<FormaPagamento, string> = {
  pix: "PIX",
  boleto: "Boleto",
};

const OPCOES_PARCELAS = Array.from({ length: 11 }, (_, i) => i + 2); // 2..12

export function SecaoParcelas() {
  const form = useFormContext<FormularioContratoValues>();
  const { fields, replace } = useFieldArray({ control: form.control, name: "parcelas" });

  const numeroParcelas = form.watch("numero_parcelas");
  const valorTotal = form.watch("valor_total") ?? 0;
  const parcelas = form.watch("parcelas") ?? [];

  // Mudar o select de "Quantas Parcelas?" precisa adicionar/remover campos
  // de parcela na hora, preservando os valores já preenchidos que continuam
  // dentro do novo tamanho.
  useEffect(() => {
    const alvo = numeroParcelas ?? 0;
    if (fields.length === alvo) return;
    const atuais = form.getValues("parcelas") ?? [];
    const novas = Array.from(
      { length: alvo },
      (_, i) => atuais[i] ?? { valor: 0, data: "", forma_pagamento: undefined as unknown as FormaPagamento }
    );
    replace(novas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numeroParcelas]);

  const totalParcelas = parcelas.reduce((acc, p) => acc + (p?.valor ?? 0), 0);
  const diferenca = totalParcelas - valorTotal;
  const bateComTotal = Math.abs(diferenca) <= 0.01;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="valor_total"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valor Total do Contrato *</FormLabel>
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
          name="numero_parcelas"
          render={({ field }) => (
            <FormItem>
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
                  {OPCOES_PARCELAS.map((n) => (
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

      </div>

      <div className="space-y-3">
        {fields.map((item, index) => (
          <Card key={item.id} className="border-muted-foreground/30">
            <CardContent className="grid items-start gap-3 pt-6 sm:grid-cols-[auto_1fr_1fr_1fr]">
              <span className="self-center text-sm font-semibold text-muted-foreground">
                Parcela {index + 1} de {fields.length}
              </span>

              <FormField
                control={form.control}
                name={`parcelas.${index}.valor`}
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
                name={`parcelas.${index}.data`}
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
                name={`parcelas.${index}.forma_pagamento`}
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
      </div>

      <div className="space-y-1 rounded-lg border p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Parcelas</span>
          <span className="font-medium">{formatBRL(totalParcelas)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Esperado</span>
          <span className="font-medium">{formatBRL(valorTotal)}</span>
        </div>

        {valorTotal <= 0 ? (
          <p className="pt-2 text-sm text-muted-foreground">
            Informe o valor total do contrato para validar a soma.
          </p>
        ) : (
          <div
            className={cn(
              "flex items-center gap-2 pt-2 font-semibold",
              bateComTotal ? "text-success" : "text-destructive"
            )}
          >
            {bateComTotal ? (
              <>
                <Check className="h-4 w-4" />
                Soma bate com o valor total
              </>
            ) : (
              <>
                <X className="h-4 w-4" />
                Soma não bate com o valor total (diferença de {formatBRL(Math.abs(diferenca))})
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
