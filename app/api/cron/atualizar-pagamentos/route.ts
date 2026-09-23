import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const JOB_NOME = "atualizar-pagamentos-projetados";

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

export async function GET(request: NextRequest) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  console.log(`[${JOB_NOME}] iniciado`);

  const { data: quantidadeAtualizada, error } = await supabase.rpc(
    "atualizar_pagamentos_vencidos"
  );

  if (error) {
    console.error(`[${JOB_NOME}] erro:`, error);
    await supabase.from("cron_logs").insert({
      job_nome: JOB_NOME,
      quantidade_atualizada: 0,
      status: "ERRO",
      detalhes: { erro: error.message },
    });
    return NextResponse.json(
      { error: "Erro ao atualizar pagamentos", details: error.message },
      { status: 500 }
    );
  }

  console.log(`[${JOB_NOME}] ${quantidadeAtualizada} pagamento(s) atualizado(s) de PROJETADO para PAGO`);

  await supabase.from("cron_logs").insert({
    job_nome: JOB_NOME,
    quantidade_atualizada: quantidadeAtualizada ?? 0,
    status: "SUCESSO",
  });

  // Cache do dashboard (KPIs, mês a mês) é 100% client-side via React Query,
  // sem cache de servidor Next.js (sem fetch cacheado nem unstable_cache) —
  // não há nada pra invalidar aqui. O próximo carregamento de página já
  // busca os dados atualizados direto do Supabase.

  console.log(`[${JOB_NOME}] concluído com sucesso`);

  return NextResponse.json({
    success: true,
    atualizados: quantidadeAtualizada ?? 0,
  });
}
