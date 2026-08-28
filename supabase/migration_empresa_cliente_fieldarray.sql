-- ROMA BC — Fase 1 — Migration: Empresa Cliente vira FieldArray (múltiplas por contrato)
--
-- Antes: 1 contrato -> 1 cliente (contratos.cliente_id, FK única).
-- Agora: 1 contrato -> N empresas, via tabela de ligação contrato_empresas.
-- clientes continua deduplicada por CNPJ (mesma empresa em contratos
-- diferentes = mesma linha, como sempre foi) — só a relação com contrato
-- passa a ser many-to-many em vez de uma FK direta.
--
-- contratos.cliente_id é MANTIDA (a coluna não é dropada — evita alterar uma
-- constraint NOT NULL/FK existente sem necessidade) e continua sendo
-- preenchida com a primeira empresa do contrato, mas o app não lê mais por
-- ela: fetchClientes/fetchClienteDetalhes passam a usar contrato_empresas
-- como fonte da verdade. Isso é o que permite migrar sem quebrar nada.
--
-- Execute no SQL Editor do Supabase. Idempotente.

create table if not exists contrato_empresas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contratos (id) on delete cascade,
  cliente_id uuid not null references clientes (id),
  data_criacao timestamptz not null default now(),
  unique (contrato_id, cliente_id)
);

create index if not exists idx_contrato_empresas_contrato_id on contrato_empresas (contrato_id);
create index if not exists idx_contrato_empresas_cliente_id on contrato_empresas (cliente_id);

alter table contrato_empresas disable row level security;

-- Backfill: todo contrato existente (modelo antigo, 1 cliente_id) ganha o
-- link equivalente na tabela nova, senão ele "desapareceria" das consultas
-- que passam a usar contrato_empresas.
insert into contrato_empresas (contrato_id, cliente_id)
select id, cliente_id from contratos where cliente_id is not null
on conflict (contrato_id, cliente_id) do nothing;

create or replace function criar_contrato_completo(payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_cliente_id uuid;
  v_primeira_empresa_id uuid;
  v_contrato_id uuid;
  v_empresa jsonb;
  v_pessoa jsonb;
  v_principais_count int := 0;
  v_data_primeiro date;
  v_dia_vencimento smallint;
  v_valor_mensal numeric(14, 2);
  v_valor_primeiro numeric(14, 2);
  v_data_venc date;
  v_dias_no_mes int;
  i int;
begin
  -- 1) upsert de cada empresa (por CNPJ) e criação do contrato usando a
  -- primeira como cliente_id "legado" (satisfaz a FK NOT NULL existente).
  for v_empresa in select * from jsonb_array_elements(payload->'empresas')
  loop
    select id into v_cliente_id
    from clientes
    where cpf_cnpj_responsavel = v_empresa->>'cpf_cnpj_responsavel';

    if v_cliente_id is null then
      insert into clientes (nome_razao_social, cpf_cnpj_responsavel, cidade, estado, faturamento_medio, ativo)
      values (
        v_empresa->>'nome_razao_social',
        v_empresa->>'cpf_cnpj_responsavel',
        v_empresa->>'cidade',
        v_empresa->>'estado',
        nullif(v_empresa->>'faturamento_medio', '')::numeric,
        true
      )
      returning id into v_cliente_id;
    else
      update clientes set
        nome_razao_social = v_empresa->>'nome_razao_social',
        cidade = v_empresa->>'cidade',
        estado = v_empresa->>'estado',
        faturamento_medio = nullif(v_empresa->>'faturamento_medio', '')::numeric,
        data_atualizacao = now()
      where id = v_cliente_id;
    end if;

    if v_primeira_empresa_id is null then
      v_primeira_empresa_id := v_cliente_id;
    end if;
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
    data_inicio_consultoria, data_onboarding, observacoes, contexto_perfil_cliente, status,
    grau_dificuldade
  ) values (
    v_primeira_empresa_id,
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
    coalesce(payload->>'contexto_perfil_cliente', ''),
    'ativo',
    coalesce(payload->>'grau_dificuldade', 'MEDIO')
  )
  returning id into v_contrato_id;

  -- 2) liga TODAS as empresas (não só a primeira) ao contrato.
  for v_empresa in select * from jsonb_array_elements(payload->'empresas')
  loop
    select id into v_cliente_id
    from clientes
    where cpf_cnpj_responsavel = v_empresa->>'cpf_cnpj_responsavel';

    insert into contrato_empresas (contrato_id, cliente_id)
    values (v_contrato_id, v_cliente_id)
    on conflict (contrato_id, cliente_id) do nothing;
  end loop;

  -- 3) pessoas (inalterado desde a migration anterior).
  for v_pessoa in select * from jsonb_array_elements(payload->'pessoas')
  loop
    insert into pessoas_cliente (
      contrato_id, cpf, nome_completo, faturamento_medio, telefone, email,
      data_nascimento, rede_social, funcao, eh_principal
    ) values (
      v_contrato_id,
      v_pessoa->>'cpf',
      v_pessoa->>'nome_completo',
      nullif(v_pessoa->>'faturamento_medio', '')::numeric,
      v_pessoa->>'telefone',
      v_pessoa->>'email',
      nullif(v_pessoa->>'data_nascimento', '')::date,
      v_pessoa->>'rede_social',
      v_pessoa->>'funcao',
      coalesce((v_pessoa->>'eh_principal')::boolean, false)
    );

    if coalesce((v_pessoa->>'eh_principal')::boolean, false) then
      v_principais_count := v_principais_count + 1;
    end if;
  end loop;

  if v_principais_count > 1 then
    raise exception 'Apenas uma pessoa pode ser marcada como principal';
  end if;

  -- 4) 12 parcelas projetadas (inalterado).
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

  return jsonb_build_object('cliente_id', v_primeira_empresa_id, 'contrato_id', v_contrato_id);
end;
$$;

grant execute on function criar_contrato_completo(jsonb) to anon, authenticated;

-- Confira: contrato_empresas deve existir com rowsecurity = false, e o
-- backfill deve ter 1+ linha (pelo menos o contrato de teste anterior).
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'contrato_empresas';
select count(*) as empresas_vinculadas from contrato_empresas;
