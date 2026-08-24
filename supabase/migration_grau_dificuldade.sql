-- ROMA BC — Fase 1 — Migration: Grau de Dificuldade do Cliente
-- Execute no SQL Editor do seu projeto Supabase (banco já provisionado com
-- supabase/schema.sql e SQL_DADOS_BASICOS.sql). Idempotente: pode rodar mais de uma vez.

alter table contratos
  add column if not exists grau_dificuldade text not null default 'MEDIO';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contratos_grau_dificuldade_check'
  ) then
    alter table contratos
      add constraint contratos_grau_dificuldade_check
      check (grau_dificuldade in ('BAIXO', 'MEDIO', 'ALTO'));
  end if;
end $$;

create index if not exists idx_contratos_grau_dificuldade on contratos (grau_dificuldade);

-- Recria a função com o novo campo (mesma lógica de supabase/schema.sql).
create or replace function criar_contrato_completo(payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_cliente_id uuid;
  v_contrato_id uuid;
  v_contato jsonb;
  v_data_primeiro date;
  v_dia_vencimento smallint;
  v_valor_consultoria numeric(14, 2);
  v_valor_primeiro numeric(14, 2);
  v_data_venc date;
  v_dias_no_mes int;
  i int;
begin
  select id into v_cliente_id from clientes where cnpj = payload->'empresa'->>'cnpj';

  if v_cliente_id is null then
    insert into clientes (razao_social, cnpj, cidade, estado, faturamento_medio)
    values (
      payload->'empresa'->>'razao_social',
      payload->'empresa'->>'cnpj',
      payload->'empresa'->>'cidade',
      payload->'empresa'->>'estado',
      nullif(payload->'empresa'->>'faturamento_medio', '')::numeric
    )
    returning id into v_cliente_id;
  else
    update clientes set
      razao_social = payload->'empresa'->>'razao_social',
      cidade = payload->'empresa'->>'cidade',
      estado = payload->'empresa'->>'estado',
      faturamento_medio = nullif(payload->'empresa'->>'faturamento_medio', '')::numeric,
      updated_at = now()
    where id = v_cliente_id;
  end if;

  for v_contato in select * from jsonb_array_elements(payload->'contatos')
  loop
    insert into contatos_cliente (
      cliente_id, nome, telefone, email, funcao, funcao_outro_descricao, rede_social, data_nascimento
    ) values (
      v_cliente_id,
      v_contato->>'nome',
      v_contato->>'telefone',
      v_contato->>'email',
      v_contato->>'funcao',
      v_contato->>'funcao_outro_descricao',
      v_contato->>'rede_social',
      nullif(v_contato->>'data_nascimento', '')::date
    );
  end loop;

  v_valor_consultoria := (payload->'pagamento'->>'valor_consultoria')::numeric;
  v_data_primeiro := (payload->'pagamento'->>'data_primeiro_pagamento')::date;
  v_dia_vencimento := (payload->'pagamento'->>'dia_vencimento')::smallint;
  v_valor_primeiro := coalesce(
    nullif(payload->'pagamento'->>'valor_primeiro_pagamento', '')::numeric,
    v_valor_consultoria
  );

  insert into contratos (
    cliente_id, produto_id, une, valor_consultoria, plano, recorrente,
    data_primeiro_pagamento, valor_primeiro_pagamento, dia_vencimento,
    data_inicio_consultoria, data_onboarding, consultora_id, observacoes, status,
    grau_dificuldade
  ) values (
    v_cliente_id,
    (payload->>'produto_id')::uuid,
    payload->>'une',
    v_valor_consultoria,
    payload->'pagamento'->>'plano',
    (payload->'pagamento'->>'recorrente')::boolean,
    v_data_primeiro,
    v_valor_primeiro,
    v_dia_vencimento,
    nullif(payload->'pagamento'->>'data_inicio_consultoria', '')::date,
    nullif(payload->'pagamento'->>'data_onboarding', '')::date,
    (payload->>'consultora_id')::uuid,
    payload->>'observacoes',
    'ativo',
    coalesce(payload->>'grau_dificuldade', 'MEDIO')
  )
  returning id into v_contrato_id;

  for i in 0..11 loop
    if i = 0 then
      v_data_venc := v_data_primeiro;
    else
      v_dias_no_mes := extract(
        day from (
          date_trunc('month', v_data_primeiro + (i || ' months')::interval) + interval '1 month - 1 day'
        )
      )::int;
      v_data_venc := date_trunc('month', v_data_primeiro + (i || ' months')::interval)::date
                     + (least(v_dia_vencimento, v_dias_no_mes) - 1);
    end if;

    insert into pagamentos_projetados (
      contrato_id, numero_parcela, mes, ano, valor_projetado, data_vencimento, status
    ) values (
      v_contrato_id,
      i + 1,
      extract(month from v_data_venc)::smallint,
      extract(year from v_data_venc)::int,
      case when i = 0 then v_valor_primeiro else v_valor_consultoria end,
      v_data_venc,
      'projetado'
    );
  end loop;

  return jsonb_build_object('cliente_id', v_cliente_id, 'contrato_id', v_contrato_id);
end;
$$;

grant execute on function criar_contrato_completo(jsonb) to anon, authenticated;
