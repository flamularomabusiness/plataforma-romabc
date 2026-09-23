"use client";

import { useEffect, useRef } from "react";
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
import { FORMAS_PAGAMENTO, TIPOS_PAGAMENTO, type FormaPagamento, type TipoPagamento } from "@/lib/types";
import { maskCurrencyToNumber, formatCurrencyInput } from "@/lib/masks";
import { useProdutoPlanos } from "@/lib/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { SecaoParcelas } from "./secao-parcelas";
import { SecaoEntradaContrato } from "./secao-entrada";
import type { FormularioContratoValues } from "./form-schema";

const TIPO_PAGAMENTO_LABELS: Record<TipoPagamento, string> = {
  recorrente: "Recorrente (mensal)",
  venda_unica: "Venda Única",
  parcelado: "Parcelado",
};

const FORMA_PAGAMENTO_LABELS: Record<FormaPagamento, string> = {
  pix: "PIX",
  boleto: "Boleto",
};

export function SecaoPagamento() {
  const form = useFormContext<FormularioContratoValues>();
  const tipoPagamento = form.watch("tipo_pagamento");
  const valorMensal = form.watch("valor_mensal");
  const valorPrimeiroPagamento = form.watch("valor_primeiro_pagamento");
  const produtoId = form.watch("produto_id");
  const { data: planos, isLoading: loadingPlanos } = useProdutoPlanos(produtoId);

  useEffect(() => {
    if (valorPrimeiroPagamento === null || valorPrimeiroPagamento === undefined) {
      form.setValue("valor_primeiro_pagamento", valorMensal || null, {
        shouldValidate: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorMensal]);

  // Trocar de produto invalida o plano escolhido (planos são por produto) —
  // ignora o mount inicial pra não apagar um plano restaurado do rascunho.
  const produtoIdMontagem = useRef(produtoId);
  useEffect(() => {
    if (produtoId === produtoIdMontagem.current) return;
    form.setValue("plano_contratado", "", { shouldValidate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtoId]);

  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="tipo_pagamento"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tipo de Pagamento *</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de pagamento" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {TIPOS_PAGAMENTO.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {TIPO_PAGAMENTO_LABELS[tipo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="plano_contratado"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Plano Contratado *</FormLabel>
              {loadingPlanos ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={!produtoId || (planos ?? []).length === 0}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          produtoId ? "Selecione o plano" : "Selecione um produto primeiro"
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(planos ?? []).map((plano) => (
                      <SelectItem key={plano.id} value={plano.nome}>
                        {plano.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {tipoPagamento === "recorrente" && (
          <>
            <FormField
              control={form.control}
              name="valor_mensal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor do Contrato (Mensal) *</FormLabel>
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
              name="forma_pagamento_padrao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Forma de Pagamento *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
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
          </>
        )}

        {tipoPagamento === "venda_unica" && (
          <>
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
              name="data_pagamento_unico"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data do Pagamento *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="forma_pagamento_padrao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Forma de Pagamento *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
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
          </>
        )}

        <FormField
          control={form.control}
          name="data_inicio_consultoria"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data Início do Contrato</FormLabel>
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

      <SecaoEntradaContrato />

      {tipoPagamento === "parcelado" && <SecaoParcelas />}
    </div>
  );
}
