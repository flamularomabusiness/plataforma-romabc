-- ROMA BC — Fase 1 — Migration: Tipo de Pagamento (Recorrente / Venda Única / Parcelado)
--
-- contratos já tinha as colunas tipo_pagamento / valor_entrada / data_entrada /
-- numero_parcelas (provisionadas antes desta migration), e pagamentos_projetados
-- já tinha numero_parcela — mas faltava valor_total em contratos, e a função
-- criar_contrato_completo ainda ignorava tipo_pagamento (sempre gerava 12
-- parcelas mensais, independente do tipo escolhido no formulário).
--
-- valor_mensal / valor_primeiro_pagamento / data_inicio_primeiro_pagamento /
-- data_vencimento_mensal só fazem sentido para tipo_pagamento = 'recorrente';
-- venda_unica e parcelado não os preenchem, então deixam de ser NOT NULL.
--
-- CORREÇÃO IMPORTANTE nesta versão: pagamentos_projetados.status tem uma
-- check constraint que exige os valores em MAIÚSCULO ('PROJETADO', 'PAGO',
-- 'ATRASADO', 'CANCELADO') — confirmado testando um insert direto contra o
-- banco. As versões anteriores desta função (nas migrations passadas) inseriam
-- 'projetado' minúsculo, o que teria feito TODA criação de contrato falhar
-- (a transação inteira dá rollback no passo final de inserir os pagamentos)
-- assim que esta função fosse recriada e usada. Corrigido para 'PROJETADO'
-- em todos os inserts abaixo.
--
-- Execute no SQL Editor do Supabase. Idempotente.

alter table contratos add column if not exists tipo_pagamento text not null default 'recorrente';
alter table contratos add column if not exists valor_total numeric(14, 2);
alter table contratos add column if not exists valor_entrada numeric(14, 2);
alter table contratos add column if not exists data_entrada date;
alter table contratos add column if not exists numero_parcelas smallint;

alter table contratos alter column valor_mensal drop not null;
alter table contratos alter column valor_primeiro_pagamento drop not null;
alter table contratos alter column data_inicio_primeiro_pagamento drop not null;
alter table contratos alter column data_vencimento_mensal drop not null;

alter table pagamentos_projetados add column if not exists numero_parcela smallint;

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
  v_parcela jsonb;
  v_principais_count int := 0;
  v_tipo_pagamento text;
  v_data_primeiro date;
  v_dia_vencimento smallint;
  v_valor_mensal numeric(14, 2);
  v_valor_primeiro numeric(14, 2);
  v_valor_total numeric(14, 2);
  v_data_pagamento_unico date;
  v_valor_entrada numeric(14, 2);
  v_data_entrada date;
  v_numero_parcelas smallint;
  v_data_venc date;
  v_dias_no_mes int;
  v_numero_parcela smallint;
  i int;
begin
  -- 1) upsert de cada empresa (por CNPJ) — inalterado desde a migration anterior.
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

  -- 2) lê os campos de pagamento conforme o tipo escolhido.
  v_tipo_pagamento := coalesce(payload->'pagamento'->>'tipo_pagamento', 'recorrente');

  if v_tipo_pagamento = 'recorrente' then
    v_valor_mensal := (payload->'pagamento'->>'valor_mensal')::numeric;
    v_data_primeiro := (payload->'pagamento'->>'data_inicio_primeiro_pagamento')::date;
    v_dia_vencimento := (payload->'pagamento'->>'data_vencimento_mensal')::smallint;
    v_valor_primeiro := coalesce(
      nullif(payload->'pagamento'->>'valor_primeiro_pagamento', '')::numeric,
      v_valor_mensal
    );
  elsif v_tipo_pagamento = 'venda_unica' then
    v_valor_total := (payload->'pagamento'->>'valor_total')::numeric;
    v_data_pagamento_unico := (payload->'pagamento'->>'data_pagamento_unico')::date;
  elsif v_tipo_pagamento = 'parcelado' then
    v_valor_total := (payload->'pagamento'->>'valor_total')::numeric;
    v_valor_entrada := (payload->'pagamento'->>'valor_entrada')::numeric;
    v_data_entrada := (payload->'pagamento'->>'data_entrada')::date;
    v_numero_parcelas := (payload->'pagamento'->>'numero_parcelas')::smallint;
  end if;

  insert into contratos (
    cliente_id, produto_id, une_id, consultora_id, plano_contratado, recorrente,
    tipo_pagamento, valor_mensal, valor_primeiro_pagamento, data_inicio_primeiro_pagamento,
    data_vencimento_mensal, valor_total, valor_entrada, data_entrada, numero_parcelas,
    data_inicio_consultoria, data_onboarding, observacoes, contexto_perfil_cliente, status,
    grau_dificuldade
  ) values (
    v_primeira_empresa_id,
    (payload->>'produto_id')::uuid,
    (payload->>'une_id')::uuid,
    (payload->>'consultora_id')::uuid,
    payload->'pagamento'->>'plano_contratado',
    (v_tipo_pagamento = 'recorrente'),
    v_tipo_pagamento,
    v_valor_mensal,
    v_valor_primeiro,
    v_data_primeiro,
    v_dia_vencimento,
    v_valor_total,
    v_valor_entrada,
    v_data_entrada,
    v_numero_parcelas,
    nullif(payload->'pagamento'->>'data_inicio_consultoria', '')::date,
    nullif(payload->'pagamento'->>'data_onboarding', '')::date,
    payload->>'observacoes',
    coalesce(payload->>'contexto_perfil_cliente', ''),
    'ativo',
    coalesce(payload->>'grau_dificuldade', 'MEDIO')
  )
  returning id into v_contrato_id;

  -- 3) liga TODAS as empresas ao contrato — inalterado.
  for v_empresa in select * from jsonb_array_elements(payload->'empresas')
  loop
    select id into v_cliente_id
    from clientes
    where cpf_cnpj_responsavel = v_empresa->>'cpf_cnpj_responsavel';

    insert into contrato_empresas (contrato_id, cliente_id)
    values (v_contrato_id, v_cliente_id)
    on conflict (contrato_id, cliente_id) do nothing;
  end loop;

  -- 4) pessoas — inalterado.
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

  -- 5) pagamentos projetados — gerados de forma diferente por tipo_pagamento.
  if v_tipo_pagamento = 'recorrente' then
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
        'PROJETADO'
      );
    end loop;

  elsif v_tipo_pagamento = 'venda_unica' then
    insert into pagamentos_projetados (
      contrato_id, mes, ano, valor_projetado, data_vencimento, status
    ) values (
      v_contrato_id,
      extract(month from v_data_pagamento_unico)::smallint,
      extract(year from v_data_pagamento_unico)::int,
      v_valor_total,
      v_data_pagamento_unico,
      'PROJETADO'
    );

  elsif v_tipo_pagamento = 'parcelado' then
    -- entrada = numero_parcela 0, parcelas manuais = numero_parcela 1..N
    -- (mesma numeração exibida no formulário, "Parcela X de N").
    insert into pagamentos_projetados (
      contrato_id, mes, ano, valor_projetado, data_vencimento, status, numero_parcela
    ) values (
      v_contrato_id,
      extract(month from v_data_entrada)::smallint,
      extract(year from v_data_entrada)::int,
      v_valor_entrada,
      v_data_entrada,
      'PROJETADO',
      0
    );

    v_numero_parcela := 1;
    for v_parcela in select * from jsonb_array_elements(payload->'pagamento'->'parcelas')
    loop
      insert into pagamentos_projetados (
        contrato_id, mes, ano, valor_projetado, data_vencimento, status, numero_parcela
      ) values (
        v_contrato_id,
        extract(month from (v_parcela->>'data')::date)::smallint,
        extract(year from (v_parcela->>'data')::date)::int,
        (v_parcela->>'valor')::numeric,
        (v_parcela->>'data')::date,
        'PROJETADO',
        v_numero_parcela
      );
      v_numero_parcela := v_numero_parcela + 1;
    end loop;
  end if;

  return jsonb_build_object('cliente_id', v_primeira_empresa_id, 'contrato_id', v_contrato_id);
end;
$$;

grant execute on function criar_contrato_completo(jsonb) to anon, authenticated;

-- Confira: contratos.valor_total deve existir agora.
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'contratos' and column_name = 'valor_total';
