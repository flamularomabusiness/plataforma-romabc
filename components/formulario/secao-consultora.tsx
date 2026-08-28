"use client";

import { useFormContext } from "react-hook-form";

import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useConsultoras } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { GRAUS_DIFICULDADE, type GrauDificuldade } from "@/lib/types";
import type { FormularioContratoValues } from "./form-schema";

const GRAU_OPCOES: Record<
  GrauDificuldade,
  { label: string; selectedClass: string }
> = {
  BAIXO: { label: "Baixo", selectedClass: "border-success bg-success text-success-foreground" },
  MEDIO: { label: "Médio", selectedClass: "border-warning bg-warning text-warning-foreground" },
  ALTO: { label: "Alto", selectedClass: "border-destructive bg-destructive text-destructive-foreground" },
};

const CONTEXTO_PLACEHOLDER = `PERFIL E CONTEXTO DO CLIENTE/EMPRESA

Sobre a Empresa:
[Descreva: o que faz, há quanto tempo existe, quantos funcionários, localização]

Segmento:
- Indústria: [ex: SaaS, Varejo, Agência]
- Setor: [ex: Software, Vestuário, Marketing]
- Faturamento Estimado: [ex: R$ 500k - 1M/ano]

Histórico e Trajetória:
[Como começou, principais marcos, evolução da empresa]

Base de Clientes:
- Quantos clientes tem
- Ticket médio
- Principais clientes

Maiores Dores e Desafios:
1. [Dor crítica]: [descrição]
2. [Dor importante]: [descrição]
3. [Dor média]: [descrição]

O Que Espera da ROMA BC:
[O que quer resolver com nossas soluções]`;

export function SecaoConsultora() {
  const form = useFormContext<FormularioContratoValues>();
  const { data: consultoras, isLoading } = useConsultoras();

  return (
    <div className="grid gap-6">
      <FormField
        control={form.control}
        name="consultora_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Consultora Responsável *</FormLabel>
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a consultora" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(consultoras ?? []).map((consultora) => (
                    <SelectItem key={consultora.id} value={consultora.id}>
                      {consultora.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="grau_dificuldade"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Grau de Dificuldade *</FormLabel>
            <FormControl>
              <div className="flex flex-col gap-2 sm:flex-row" role="radiogroup" aria-label="Grau de Dificuldade">
                {GRAUS_DIFICULDADE.map((grau) => {
                  const opcao = GRAU_OPCOES[grau];
                  const selecionado = field.value === grau;
                  return (
                    <button
                      key={grau}
                      type="button"
                      role="radio"
                      aria-checked={selecionado}
                      onClick={() => field.onChange(grau)}
                      className={cn(
                        "flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        selecionado
                          ? opcao.selectedClass
                          : "border-input bg-background text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {opcao.label}
                    </button>
                  );
                })}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Contexto e Perfil do Cliente</h3>
          <p className="text-sm text-muted-foreground">
            Quanto mais detalhado, melhor a consultoria consegue entender o cliente antes do
            primeiro contato.
          </p>
        </div>

        <FormField
          control={form.control}
          name="contexto_perfil_cliente"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contexto e Perfil do Cliente/Empresa *</FormLabel>
              <FormControl>
                <Textarea
                  className="h-[300px]"
                  placeholder={CONTEXTO_PLACEHOLDER}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Observações Adicionais</h3>
        </div>

        <FormField
          control={form.control}
          name="observacoes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea
                  className="h-[150px]"
                  placeholder="Informações adicionais, notas, detalhes..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
