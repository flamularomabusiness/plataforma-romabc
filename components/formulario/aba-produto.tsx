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

export function AbaProduto() {
  const form = useFormContext<FormularioContratoValues>();
  const uneId = form.watch("une_id");
  const { data: unes, isLoading: loadingUnes } = useUNEs();
  const { data: produtos, isLoading: loadingProdutos } = useProdutos(uneId || undefined);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <FormField
        control={form.control}
        name="une_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>UNE *</FormLabel>
            {loadingUnes ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  form.setValue("produto_id", "");
                }}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a UNE" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(unes ?? []).map((une) => (
                    <SelectItem key={une.id} value={une.id}>
                      {une.nome}
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
        name="produto_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Produto/Serviço *</FormLabel>
            {loadingProdutos ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select onValueChange={field.onChange} value={field.value} disabled={!uneId}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto/serviço" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(produtos ?? []).map((produto) => (
                    <SelectItem key={produto.id} value={produto.id}>
                      {produto.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!uneId && <FormDescription>Selecione a UNE primeiro.</FormDescription>}
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
