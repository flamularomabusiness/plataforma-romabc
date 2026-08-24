"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCriarContrato } from "@/lib/queries";
import type { NovoContratoPayload } from "@/lib/types";
import { redirectPathAfterFormulario } from "@/lib/auth";

import {
  ABAS,
  AbaId,
  RASCUNHO_KEY,
  formularioContratoSchema,
  valoresPadrao,
  type FormularioContratoValues,
} from "@/components/formulario/form-schema";
import { AbaProduto } from "@/components/formulario/aba-produto";
import { AbaEmpresa } from "@/components/formulario/aba-empresa";
import { AbaContatos } from "@/components/formulario/aba-contatos";
import { AbaPagamento } from "@/components/formulario/aba-pagamento";
import { AbaConsultora } from "@/components/formulario/aba-consultora";

const CAMPOS_POR_ABA: Record<AbaId, string[]> = {
  produto: ["produto_id", "une_id"],
  empresa: ["nome_razao_social", "cpf_cnpj_responsavel", "cidade", "estado", "faturamento_medio"],
  contatos: ["contatos"],
  pagamento: [
    "valor_mensal",
    "plano_contratado",
    "recorrente",
    "data_inicio_primeiro_pagamento",
    "valor_primeiro_pagamento",
    "data_vencimento_mensal",
    "data_inicio_consultoria",
    "data_onboarding",
  ],
  consultora: ["consultora_id", "grau_dificuldade", "contexto_perfil_cliente", "observacoes"],
};

export default function FormularioPage() {
  const router = useRouter();
  const [abaAtiva, setAbaAtiva] = useState<AbaId>("produto");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const form = useForm<FormularioContratoValues>({
    resolver: zodResolver(formularioContratoSchema),
    defaultValues: valoresPadrao,
    mode: "onChange",
  });

  const criarContrato = useCriarContrato();

  useEffect(() => {
    const raw = window.localStorage.getItem(RASCUNHO_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      form.reset(draft);
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

  const indiceAtual = ABAS.findIndex((a) => a.id === abaAtiva);
  const progresso = ((indiceAtual + 1) / ABAS.length) * 100;

  async function irParaProxima() {
    const campos = CAMPOS_POR_ABA[abaAtiva] as any;
    const valido = await form.trigger(campos);
    if (!valido) return;
    if (indiceAtual < ABAS.length - 1) {
      setAbaAtiva(ABAS[indiceAtual + 1].id);
    }
  }

  function irParaAnterior() {
    if (indiceAtual > 0) {
      setAbaAtiva(ABAS[indiceAtual - 1].id);
    }
  }

  function limparFormulario() {
    form.reset(valoresPadrao);
    window.localStorage.removeItem(RASCUNHO_KEY);
    setAbaAtiva("produto");
    toast.success("Formulário limpo");
  }

  async function onSubmit(values: FormularioContratoValues) {
    const payload: NovoContratoPayload = {
      produto_id: values.produto_id,
      une_id: values.une_id,
      empresa: {
        nome_razao_social: values.nome_razao_social,
        cpf_cnpj_responsavel: values.cpf_cnpj_responsavel,
        cidade: values.cidade || null,
        estado: values.estado || null,
        faturamento_medio: values.faturamento_medio ?? null,
      },
      contatos: values.contatos.map((c) => ({
        nome: c.nome,
        telefone: c.telefone,
        email: c.email,
        funcao: c.funcao,
        descricao_outro: c.descricao_outro || null,
        rede_social: c.rede_social || null,
        data_nascimento: c.data_nascimento || null,
      })),
      pagamento: {
        valor_mensal: values.valor_mensal,
        plano_contratado: values.plano_contratado,
        recorrente: values.recorrente,
        data_inicio_primeiro_pagamento: values.data_inicio_primeiro_pagamento,
        valor_primeiro_pagamento: values.valor_primeiro_pagamento ?? null,
        data_vencimento_mensal: values.data_vencimento_mensal,
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
      setAbaAtiva("produto");
      router.push(redirectPathAfterFormulario());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar contrato");
    }
  }

  const podeEnviar =
    !criarContrato.isPending &&
    !(form.formState.isSubmitted && !form.formState.isValid);

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-primary">Novo Contrato</CardTitle>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>
                  Aba {indiceAtual + 1}/{ABAS.length} — {ABAS[indiceAtual].label}
                </span>
                <span>{Math.round(progresso)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progresso}%` }}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Tabs value={abaAtiva} onValueChange={(v) => setAbaAtiva(v as AbaId)}>
                  <TabsList className="grid w-full grid-cols-5">
                    {ABAS.map((aba, i) => (
                      <TabsTrigger key={aba.id} value={aba.id} className="text-xs">
                        {i + 1}. {aba.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <TabsContent value="produto">
                    <AbaProduto />
                  </TabsContent>
                  <TabsContent value="empresa">
                    <AbaEmpresa />
                  </TabsContent>
                  <TabsContent value="contatos">
                    <AbaContatos />
                  </TabsContent>
                  <TabsContent value="pagamento">
                    <AbaPagamento />
                  </TabsContent>
                  <TabsContent value="consultora">
                    <AbaConsultora />
                  </TabsContent>
                </Tabs>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={() => router.push("/")}>
                      Cancelar
                    </Button>
                    <Button type="button" variant="outline" onClick={limparFormulario}>
                      Limpar
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={irParaAnterior}
                      disabled={indiceAtual === 0}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Anterior
                    </Button>
                    {indiceAtual < ABAS.length - 1 ? (
                      <Button type="button" onClick={irParaProxima}>
                        Próxima
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button type="submit" disabled={!podeEnviar}>
                        {criarContrato.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Enviar
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
