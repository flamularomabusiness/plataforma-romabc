-- ROMA BC — Fase 1 — Migration: alinhar app ao schema REAL do banco
--
-- DESCOBERTA: o banco de produção usa nomes de tabela/coluna diferentes dos
-- que o schema.sql original previa (ex.: contratos.valor_mensal em vez de
-- valor_consultoria, clientes.nome_razao_social em vez de razao_social, uma
-- tabela "unes" própria em vez de uma lista fixa de strings, etc). Esta
-- migration:
--   1. Desabilita RLS na tabela "unes" (mesma causa raiz do fix anterior —
--      ela não estava na lista de tabelas cobertas por fix_rls_anon_access.sql
--      porque essa tabela não existia no meu schema original).
--   2. Adiciona cidade, estado e faturamento_medio em "clientes" (nullable —
--      não existiam no schema real; mantém o escopo original da Fase 1).
--   3. Recria criar_contrato_completo() usando os nomes de coluna reais.
--
-- Execute no SQL Editor do Supabase. Idempotente.

alter table unes disable row level security;

alter table clientes
  add column if not exists cidade text,
  add column if not exists estado text,
  add column if not exists faturamento_medio numeric(14, 2);

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
  v_valor_mensal numeric(14, 2);
  v_valor_primeiro numeric(14, 2);
  v_data_venc date;
  v_dias_no_mes int;
  i int;
begin
  select id into v_cliente_id
  from clientes
  where cpf_cnpj_responsavel = payload->'empresa'->>'cpf_cnpj_responsavel';

  if v_cliente_id is null then
    insert into clientes (nome_razao_social, cpf_cnpj_responsavel, cidade, estado, faturamento_medio, ativo)
    values (
      payload->'empresa'->>'nome_razao_social',
      payload->'empresa'->>'cpf_cnpj_responsavel',
      payload->'empresa'->>'cidade',
      payload->'empresa'->>'estado',
      nullif(payload->'empresa'->>'faturamento_medio', '')::numeric,
      true
    )
    returning id into v_cliente_id;
  else
    update clientes set
      nome_razao_social = payload->'empresa'->>'nome_razao_social',
      cidade = payload->'empresa'->>'cidade',
      estado = payload->'empresa'->>'estado',
      faturamento_medio = nullif(payload->'empresa'->>'faturamento_medio', '')::numeric,
      data_atualizacao = now()
    where id = v_cliente_id;
  end if;

  for v_contato in select * from jsonb_array_elements(payload->'contatos')
  loop
    insert into contatos_cliente (
      cliente_id, nome, telefone, email, funcao, descricao_outro, rede_social, data_nascimento, ativo
    ) values (
      v_cliente_id,
      v_contato->>'nome',
      v_contato->>'telefone',
      v_contato->>'email',
      v_contato->>'funcao',
      v_contato->>'descricao_outro',
      v_contato->>'rede_social',
      nullif(v_contato->>'data_nascimento', '')::date,
      true
    );
  end loop;

  v_valor_mensal := (payload->'pagamento'->>'valor_mensal')::numeric;
  v_data_primeiro := (payload->'pagamento'->>'data_inicio_primeiro_pagamento')::date;
  v_dia_vencimento := (payload->'pagamento'->>'data_vencimento_mensal')::smallint;
  v_valor_primeiro := coalesce(
    nullif(payload->'pagamento'->>'valor_primeiro_pagamento', '')::numeric,
    v_valor_mensal
  );

  insert into contratos (
    cliente_id, produto_id, une_id, consultora_id, valor_mensal, plano_contratado, recorrente,
    data_inicio_primeiro_pagamento, valor_primeiro_pagamento, data_vencimento_mensal,
    data_inicio_consultoria, data_onboarding, observacoes, status, grau_dificuldade
  ) values (
    v_cliente_id,
    (payload->>'produto_id')::uuid,
    (payload->>'une_id')::uuid,
    (payload->>'consultora_id')::uuid,
    v_valor_mensal,
    payload->'pagamento'->>'plano_contratado',
    (payload->'pagamento'->>'recorrente')::boolean,
    v_data_primeiro,
    v_valor_primeiro,
    v_dia_vencimento,
    nullif(payload->'pagamento'->>'data_inicio_consultoria', '')::date,
    nullif(payload->'pagamento'->>'data_onboarding', '')::date,
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
      contrato_id, mes, ano, valor_projetado, data_vencimento, status
    ) values (
      v_contrato_id,
      extract(month from v_data_venc)::smallint,
      extract(year from v_data_venc)::int,
      case when i = 0 then v_valor_primeiro else v_valor_mensal end,
      v_data_venc,
      'projetado'
    );
  end loop;

  return jsonb_build_object('cliente_id', v_cliente_id, 'contrato_id', v_contrato_id);
end;
$$;

grant execute on function criar_contrato_completo(jsonb) to anon, authenticated;

-- Confira: unes deve aparecer com rowsecurity = false, e clientes deve ter
-- as 3 colunas novas.
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'unes';
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'clientes'
order by ordinal_position;
