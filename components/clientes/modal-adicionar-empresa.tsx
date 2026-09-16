"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { maskCNPJ, validarCNPJ } from "@/lib/masks";
import { useAdicionarEmpresaContrato } from "@/lib/queries";

const empresaModalSchema = z.object({
  nome_razao_social: z.string().min(1, "Razão social é obrigatória").max(255),
  cpf_cnpj_responsavel: z
    .string()
    .min(1, "CNPJ é obrigatório")
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, "CNPJ inválido")
    .refine(validarCNPJ, "CNPJ inválido"),
});

type EmpresaModalValues = z.infer<typeof empresaModalSchema>;

const valoresPadrao: EmpresaModalValues = {
  nome_razao_social: "",
  cpf_cnpj_responsavel: "",
};

export function ModalAdicionarEmpresa({
  contratoId,
  open,
  onOpenChange,
}: {
  contratoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const adicionar = useAdicionarEmpresaContrato(contratoId ?? "");

  const form = useForm<EmpresaModalValues>({
    resolver: zodResolver(empresaModalSchema),
    defaultValues: valoresPadrao,
    mode: "onTouched",
  });

  useEffect(() => {
    if (open) form.reset(valoresPadrao);
  }, [open, form]);

  function onInvalid(errors: Record<string, { message?: string } | undefined>) {
    const primeiraMensagem = Object.values(errors)[0]?.message;
    toast.error(primeiraMensagem ?? "Verifique os campos obrigatórios.");
  }

  async function onSubmit(values: EmpresaModalValues) {
    if (!contratoId) return;
    try {
      await adicionar.mutateAsync({ contratoId, payload: values });
      toast.success("Empresa adicionada com sucesso!");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar empresa");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Nova Empresa</DialogTitle>
          <DialogDescription>
            Esta empresa será adicionada como secundária (não principal) a este contrato.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome_razao_social"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Razão Social *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: ABC Comércio Ltda" {...field} />
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={adicionar.isPending}>
                {adicionar.isPending ? "Adicionando..." : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
