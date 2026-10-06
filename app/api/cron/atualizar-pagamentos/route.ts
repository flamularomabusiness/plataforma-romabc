import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { criarSupabaseAdmin } from "@/lib/supabase-admin";

const JOB_ATUALIZAR = "atualizar-pagamentos-projetados";
const JOB_ESTENDER = "estender-cronograma-recorrente";

// Vercel Cron injeta automaticamente o header
// `Authorization: Bearer ${CRON_SECRET}` nas chamadas que ele mesmo dispara —
// checar isso é o que impede qualquer request externo de disparar o job sob
// demanda (middleware.ts exclui /api/* do matcher, então essa rota fica
// aberta por padrão sem essa checagem).
function autorizado(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Roda uma RPC que retorna um `integer` (contagem) e loga o resultado em
 * cron_logs sob o job_nome dado — usado pelos dois jobs abaixo, que são
 * independentes entre si (um falhar não deve impedir o outro de rodar).
 */
async function rodarJob(supabase: SupabaseClient, jobNome: string, rpcNome: string) {
  console.log(`[${jobNome}] iniciado`);

  const { data: quantidade, error } = await supabase.rpc(rpcNome);

  if (error) {
    console.error(`[${jobNome}] erro:`, error);
    await supabase.from("cron_logs").insert({
      job_nome: jobNome,
      quantidade_atualizada: 0,
      status: "ERRO",
      detalhes: { erro: error.message },
    });
    return { ok: false as const, error: error.message };
  }

  console.log(`[${jobNome}] concluído — quantidade: ${quantidade}`);
  await supabase.from("cron_logs").insert({
    job_nome: jobNome,
    quantidade_atualizada: quantidade ?? 0,
    status: "SUCESSO",
  });
  return { ok: true as const, quantidade: (quantidade as number) ?? 0 };
}

export async function GET(request: NextRequest) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Sem usuário logado num cron, então precisa da service-role key (o role
  // anon perdeu acesso às tabelas — REVOKE por segurança).
  let supabase: SupabaseClient;
  try {
    supabase = criarSupabaseAdmin();
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Falha ao criar cliente admin";
    console.error("[cron] " + mensagem);
    return NextResponse.json({ success: false, error: mensagem }, { status: 500 });
  }

  // Independentes de propósito: um bug na extensão do cronograma recorrente
  // não deve impedir a atualização de status (e vice-versa) — cada um loga
  // o próprio resultado em cron_logs.
  const [atualizarPagamentos, estenderCronograma] = await Promise.all([
    rodarJob(supabase, JOB_ATUALIZAR, "atualizar_pagamentos_vencidos"),
    rodarJob(supabase, JOB_ESTENDER, "estender_cronograma_recorrente"),
  ]);

  // Cache do dashboard (KPIs, mês a mês) é 100% client-side via React Query,
  // sem cache de servidor Next.js (sem fetch cacheado nem unstable_cache) —
  // não há nada pra invalidar aqui. O próximo carregamento de página já
  // busca os dados atualizados direto do Supabase.

  const algumErro = !atualizarPagamentos.ok || !estenderCronograma.ok;

  return NextResponse.json(
    {
      success: !algumErro,
      atualizados: atualizarPagamentos.ok ? atualizarPagamentos.quantidade : 0,
      parcelasGeradas: estenderCronograma.ok ? estenderCronograma.quantidade : 0,
      ...(atualizarPagamentos.ok ? {} : { erroAtualizarPagamentos: atualizarPagamentos.error }),
      ...(estenderCronograma.ok ? {} : { erroEstenderCronograma: estenderCronograma.error }),
    },
    { status: algumErro ? 500 : 200 }
  );
}
