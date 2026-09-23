-- ROMA BC — Fase 1 — Migration: Cron de Atualização de Pagamentos Projetados
--
-- Cria a tabela cron_logs (log de auditoria dos jobs automáticos, mesmo
-- padrão de importacoes — gravado por quem CHAMA a função, não pela função
-- em si) e a função atualizar_pagamentos_vencidos(), chamada diariamente
-- pela rota app/api/cron/atualizar-pagamentos/route.ts (Vercel Cron).
--
-- A função faz um único UPDATE atômico: pagamentos_projetados com
-- status = 'PROJETADO' e data_vencimento <= CURRENT_DATE viram 'PAGO', com
-- data_pagamento_real copiado da própria data_vencimento de cada linha
-- (column-to-column — por isso é uma função SQL e não um .update() do
-- supabase-js, que só aceita valores estáticos). Usa CURRENT_DATE (data do
-- servidor Postgres, UTC no Supabase) em vez de receber "hoje" como
-- parâmetro da API: evita qualquer divergência de timezone entre o runtime
-- da rota e o banco.
--
-- Idempotente: rodar 2x no mesmo dia não altera nada na segunda vez, porque
-- o WHERE já exclui quem deixou de estar em 'PROJETADO' na primeira rodada.
--
-- Execute no SQL Editor do Supabase.

create table if not exists cron_logs (
  id uuid primary key default gen_random_uuid(),
  job_nome text not null,
  quantidade_atualizada int not null default 0,
  status text not null check (status in ('SUCESSO', 'ERRO')),
  detalhes jsonb,
  data_execucao timestamptz not null default now()
);

create index if not exists idx_cron_logs_job_data on cron_logs (job_nome, data_execucao desc);

alter table cron_logs disable row level security;

create or replace function atualizar_pagamentos_vencidos()
returns integer
language plpgsql
as $$
declare
  v_quantidade integer;
begin
  update pagamentos_projetados
  set
    status = 'PAGO',
    data_pagamento_real = data_vencimento,
    data_atualizacao = now()
  where
    status = 'PROJETADO'
    and data_vencimento <= current_date;

  get diagnostics v_quantidade = row_count;

  return v_quantidade;
end;
$$;
