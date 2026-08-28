"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { useCriarContrato } from "@/lib/queries";
import type { NovoContratoPayload } from "@/lib/types";
import { redirectPathAfterFormulario } from "@/lib/auth";

import {
  RASCUNHO_KEY,
  formularioContratoSchema,
  valoresPadrao,
  type FormularioContratoValues,
} from "@/components/formulario/form-schema";
import { FormLayoutGoogle } from "@/components/formulario/form-layout-google";
import { SecaoProduto } from "@/components/formulario/secao-produto";
import { SecaoEmpresaCliente } from "@/components/formulario/secao-empresa-cliente";
import { SecaoPessoaCliente } from "@/components/formulario/secao-pessoa-cliente";
import { SecaoPagamento } from "@/components/formulario/secao-pagamento";
import { SecaoConsultora } from "@/components/formulario/secao-consultora";

const SECOES_FINAIS = [
  { titulo: "Pagamento", Componente: SecaoPagamento },
  { titulo: "Consultora, Contexto e Observações", Componente: SecaoConsultora },
];

export default function FormularioPage() {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const form = useForm<FormularioContratoValues>({
    resolver: zodResolver(formularioContratoSchema),
    defaultValues: valoresPadrao,
    // Validação progressiva: erro só aparece depois que o campo é tocado
    // (ex.: ao saltar para o próximo), não a cada tecla digitada.
    mode: "onTouched",
  });

  const criarContrato = useCriarContrato();

  useEffect(() => {
    const raw = window.localStorage.getItem(RASCUNHO_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      // Um rascunho salvo antes de uma mudança no schema (ex.: "contatos" ->
      // "pessoas") não tem mais o formato esperado. Restaurar um rascunho
      // assim sobrescreveria valoresPadrao com campos faltando (o array
      // "pessoas" viraria undefined). Só restaura se o rascunho ainda for
      // válido contra o schema atual; senão descarta.
      const validado = formularioContratoSchema.safeParse(draft);
      if (validado.success) {
        form.reset(validado.data);
      } else {
        window.localStorage.removeItem(RASCUNHO_KEY);
      }
    } catch {
      window.localStorage.removeItem(RASCUNHO_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const subscription = form.watch((values) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        window.localStorage.setItem(RASCUNHO_KEY, JSON.stringify(values));
      }, 500);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  function limparFormulario() {
    form.reset(valoresPadrao);
    window.localStorage.removeItem(RASCUNHO_KEY);
    toast.success("Formulário limpo");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(values: FormularioContratoValues) {
    const payload: NovoContratoPayload = {
      produto_id: values.produto_id,
      une_id: values.une_id,
      empresas: values.empresas.map((e) => ({
        nome_razao_social: e.nome_razao_social,
        cpf_cnpj_responsavel: e.cpf_cnpj_responsavel,
        cidade: e.cidade || null,
        estado: e.estado || null,
        faturamento_medio: e.faturamento_medio,
      })),
      pessoas: values.pessoas.map((p) => ({
        cpf: p.cpf,
        nome_completo: p.nome_completo,
        faturamento_medio: p.faturamento_medio,
        telefone: p.telefone,
        email: p.email,
        data_nascimento: p.data_nascimento,
        rede_social: p.rede_social || null,
        funcao: p.funcao,
        eh_principal: p.eh_principal,
      })),
      pagamento: {
        tipo_pagamento: values.tipo_pagamento,
        plano_contratado: values.plano_contratado,
        ...(values.tipo_pagamento === "recorrente" && {
          valor_mensal: values.valor_mensal,
          data_inicio_primeiro_pagamento: values.data_inicio_primeiro_pagamento,
          valor_primeiro_pagamento: values.valor_primeiro_pagamento ?? null,
          data_vencimento_mensal: values.data_vencimento_mensal,
        }),
        ...(values.tipo_pagamento === "venda_unica" && {
          valor_total: values.valor_total,
          data_pagamento_unico: values.data_pagamento_unico,
        }),
        ...(values.tipo_pagamento === "parcelado" && {
          valor_total: values.valor_total,
          valor_entrada: values.valor_entrada,
          data_entrada: values.data_entrada,
          numero_parcelas: values.numero_parcelas,
          parcelas: values.parcelas,
        }),
        data_inicio_consultoria: values.data_inicio_consultoria || null,
        data_onboarding: values.data_onboarding || null,
      },
      consultora_id: values.consultora_id,
      grau_dificuldade: values.grau_dificuldade,
      contexto_perfil_cliente: values.contexto_perfil_cliente,
      observacoes: values.observacoes || null,
    };

    try {
      await criarContrato.mutateAsync(payload);
      toast.success("Contrato criado com sucesso!");
      window.localStorage.removeItem(RASCUNHO_KEY);
      form.reset(valoresPadrao);
      router.push(redirectPathAfterFormulario());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar contrato");
    }
  }

  const podeEnviar =
    !criarContrato.isPending &&
    !(form.formState.isSubmitted && !form.formState.isValid);

  return (
    <main className="min-h-screen bg-muted/30">
      <FormLayoutGoogle>
        <div>
          <h1 className="text-2xl font-bold text-primary">Novo Contrato</h1>
          <p className="text-sm text-muted-foreground">
            Preencha os campos abaixo. Os campos marcados com * são obrigatórios.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Produto/Serviço e UNE</CardTitle>
              </CardHeader>
              <CardContent>
                <SecaoProduto />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Empresa Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <SecaoEmpresaCliente />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pessoa Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <SecaoPessoaCliente />
              </CardContent>
            </Card>

            {SECOES_FINAIS.map(({ titulo, Componente }) => (
              <Card key={titulo}>
                <CardHeader>
                  <CardTitle className="text-lg">{titulo}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Componente />
                </CardContent>
              </Card>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => router.push("/")}>
                  Cancelar
                </Button>
                <Button type="button" variant="outline" onClick={limparFormulario}>
                  Limpar
                </Button>
              </div>

              <Button type="submit" disabled={!podeEnviar}>
                {criarContrato.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar
              </Button>
            </div>
          </form>
        </Form>
      </FormLayoutGoogle>
    </main>
  );
}
