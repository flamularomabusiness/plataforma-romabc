"use client";

import { Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { IndiceComplexidade } from "@/components/ferramentas/IndiceComplexidade";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CANAL_COMPLEXIDADE,
  planoPorNome,
  redirectSeguro,
  uuidValido,
  type MensagemComplexidade,
  type ResultadoComplexidade,
} from "@/lib/ferramentas/indice-complexidade";

/**
 * Query params (todos opcionais):
 *   cliente      — pré-preenche "Empresa / cliente"
 *   plano        — pré-seleciona o plano (Start/Fortalecer/Performar, sem diferenciar maiúsculas)
 *   form_id      — token do formulário que abriu a ferramenta; vai junto com o
 *                  resultado pra aba do formulário saber que a resposta é dela
 *   redirect_to  — caminho interno pra onde "Voltar" leva quando a ferramenta
 *                  NÃO foi aberta em aba nova pelo formulário
 */
function Conteudo() {
  const router = useRouter();
  const params = useSearchParams();

  const clienteName = params.get("cliente") ?? undefined;
  const formId = uuidValido(params.get("form_id"));
  const redirectTo = redirectSeguro(params.get("redirect_to"));
  const planoInicial = planoPorNome(params.get("plano"));

  const ultimoResultado = useRef<ResultadoComplexidade | null>(null);

  function aoSalvar(resultado: ResultadoComplexidade) {
    ultimoResultado.current = resultado;
    if (formId && typeof BroadcastChannel !== "undefined") {
      const canal = new BroadcastChannel(CANAL_COMPLEXIDADE);
      canal.postMessage({ tipo: "complexidade:resultado", ...resultado } satisfies MensagemComplexidade);
      canal.close();
    }
  }

  function irParaDestino() {
    if (!redirectTo) {
      router.push("/ferramentas");
      return;
    }
    const qs = new URLSearchParams();
    const resultado = ultimoResultado.current;
    if (resultado) {
      qs.set("avaliacao_id", resultado.avaliacao_id);
      qs.set("grau", resultado.grau_dificuldade);
      qs.set("score", String(resultado.score));
      qs.set("complexidade", resultado.complexidade);
    }
    const query = qs.toString();
    router.push(query ? `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}${query}` : redirectTo);
  }

  function voltar() {
    // Aberta pelo formulário em aba nova: o resultado já foi pra lá pelo
    // BroadcastChannel, então basta fechar esta aba (o formulário não perdeu
    // nada do que já estava preenchido).
    if (window.opener && formId) {
      window.close();
      // window.close() é ignorado se o navegador não considera a aba "aberta por script".
      setTimeout(irParaDestino, 300);
      return;
    }
    irParaDestino();
  }

  const veioDeOutraTela = !!(redirectTo || formId);

  return (
    <IndiceComplexidade
      clienteName={clienteName}
      formId={formId}
      planoInicial={planoInicial}
      onResultado={aoSalvar}
      onVoltar={veioDeOutraTela ? voltar : undefined}
      voltarLabel={formId ? "Voltar ao formulário" : "Voltar"}
    />
  );
}

export default function IndiceComplexidadePage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-4xl" />}>
      <Conteudo />
    </Suspense>
  );
}
