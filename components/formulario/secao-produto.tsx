"use client";

import { useFormContext } from "react-hook-form";

import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useProdutos, useUNEs } from "@/lib/queries";
import type { FormularioContratoValues } from "./form-schema";

export function SecaoProduto() {
  const form = useFormContext<FormularioContratoValues>();
  // Sem filtro por UNE: o fluxo agora é Produto → UNE, então precisamos de
  // todos os produtos ativos de uma vez (a UNE é derivada depois).
  const { data: produtos, isLoading: loadingProdutos } = useProdutos();
  const { data: unes, isLoading: loadingUnes } = useUNEs();

  const produtoId = form.watch("produto_id");
  const uneId = form.watch("une_id");

  const uneNomePorId = new Map((unes ?? []).map((une) => [une.id, une.nome]));
  const produtoSelecionado = produtos?.find((p) => p.id === produtoId);
  const uneSelecionada = unes?.find((u) => u.id === uneId);

  function handleProdutoChange(novoProdutoId: string) {
    const produto = produtos?.find((p) => p.id === novoProdutoId);
    form.setValue("produto_id", novoProdutoId, { shouldValidate: true });
    // UNE não é escolhida pelo usuário — é derivada automaticamente do produto.
    form.setValue("une_id", produto?.une_id ?? "", { shouldValidate: true });
  }

  return (
    <div className="grid gap-6">
      <FormField
        control={form.control}
        name="produto_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Produto/Serviço *</FormLabel>
            {loadingProdutos || loadingUnes ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select onValueChange={handleProdutoChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto/serviço" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(produtos ?? []).map((produto) => (
                    <SelectItem key={produto.id} value={produto.id}>
                      {produto.nome} ({uneNomePorId.get(produto.une_id) ?? "-"})
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
        name="une_id"
        render={() => (
          <FormItem>
            <FormLabel>UNE</FormLabel>
            <FormControl>
              <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm">
                {uneSelecionada && produtoSelecionado
                  ? `${uneSelecionada.nome} - ${produtoSelecionado.nome}`
                  : "—"}
              </div>
            </FormControl>
            <FormDescription>
              Preenchida automaticamente a partir do Produto/Serviço escolhido acima.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
