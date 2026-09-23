-- ROMA BC — Fase 1 — Migration: Entrada do Contrato + Forma de Pagamento
--
-- Duas peças novas em pagamentos_projetados:
--
-- 1) forma_pagamento ('pix'|'boleto') — em toda linha gerada a partir de
--    agora (recorrente, venda_única, parcelado e a entrada nova abaixo).
--    Nullable: linhas antigas ficam null, a obrigatoriedade é só no app.
--
-- 2) eh_entrada (boolean) — marca as linhas de uma "Entrada do Contrato"
--    NOVA e INDEPENDENTE do tipo_pagamento: decidido com o usuário que
--    QUALQUER contrato (recorrente, à vista ou parcelado) pode opcionalmente
--    ter uma entrada paga à vista ou em até 5x, além do próprio cronograma
--    (não é a mesma coisa que a entrada única que já existia só dentro de
--    tipo_pagamento='parcelado' — essa continua existindo pra contratos
--    antigos, só deixa de ser a única forma de ter entrada). numero_parcela
--    das linhas de entrada tem numeração própria (1..N dentro do grupo),
--    independente do numero_parcela do cronograma principal.
--
-- contratos.valor_entrada/data_entrada não são apagados (histórico de
-- contratos antigos depende deles) — a partir desta migration passam a
-- significar "resumo da entrada nova" (soma e menor data das linhas
-- eh_entrada=true), escrito pela própria função abaixo pra QUALQUER tipo de
-- pagamento, não só parcelado.
--
-- Execute no SQL Editor do Supabase. Idempotente.

alter table pagamentos_projetados
  add column if not exists forma_pagamento text check (forma_pagamento in ('pix', 'boleto'));

alter table pagamentos_projetados
  add column if not exists eh_entrada boolean not null default false;

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
  v_numero_parcelas smallint;
  v_numero_empresas int;
  v_data_venc date;
  v_dias_no_mes int;
  v_numero_parcela smallint;
  v_empresa_index int;
  v_forma_pagamento text;
  -- Entrada do Contrato — bloco novo, independente do tipo_pagamento.
  v_entrada jsonb;
  v_entrada_parcela jsonb;
  v_numero_entrada smallint;
  i int;
begin
  v_numero_empresas := coalesce((payload->>'numero_empresas')::int, 1);
  if v_numero_empresas < 1 then
    raise exception 'Número de empresas do grupo precisa ser pelo menos 1';
  end if;

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

  -- 2) lê os campos de pagamento conforme o tipo escolhido. valor_entrada e
  -- data_entrada não vêm mais daqui — a entrada agora é o bloco independente
  -- lido no passo 6, abaixo do cronograma principal.
  v_tipo_pagamento := coalesce(payload->'pagamento'->>'tipo_pagamento', 'recorrente');

  if v_tipo_pagamento = 'recorrente' then
    v_valor_mensal := (payload->'pagamento'->>'valor_mensal')::numeric;
    v_data_primeiro := (payload->'pagamento'->>'data_inicio_primeiro_pagamento')::date;
    v_dia_vencimento := (payload->'pagamento'->>'data_vencimento_mensal')::smallint;
    v_valor_primeiro := coalesce(
      nullif(payload->'pagamento'->>'valor_primeiro_pagamento', '')::numeric,
      v_valor_mensal
    );
    v_forma_pagamento := payload->'pagamento'->>'forma_pagamento';
  elsif v_tipo_pagamento = 'venda_unica' then
    v_valor_total := (payload->'pagamento'->>'valor_total')::numeric;
    v_data_pagamento_unico := (payload->'pagamento'->>'data_pagamento_unico')::date;
    v_forma_pagamento := payload->'pagamento'->>'forma_pagamento';
  elsif v_tipo_pagamento = 'parcelado' then
    v_valor_total := (payload->'pagamento'->>'valor_total')::numeric;
    v_numero_parcelas := (payload->'pagamento'->>'numero_parcelas')::smallint;
  end if;

  insert into contratos (
    cliente_id, produto_id, une_id, consultora_id, plano_contratado, recorrente,
    tipo_pagamento, valor_mensal, valor_primeiro_pagamento, data_inicio_primeiro_pagamento,
    data_vencimento_mensal, valor_total, numero_parcelas,
    numero_empresas,
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
    v_numero_parcelas,
    v_numero_empresas,
    nullif(payload->'pagamento'->>'data_inicio_consultoria', '')::date,
    nullif(payload->'pagamento'->>'data_onboarding', '')::date,
    payload->>'observacoes',
    coalesce(payload->>'contexto_perfil_cliente', ''),
    'ativo',
    coalesce(payload->>'grau_dificuldade', 'MEDIO')
  )
  returning id into v_contrato_id;

  -- 3) liga TODAS as empresas ao contrato — a 1ª do array (índice 0) vira a
  -- empresa principal do grupo (eh_principal = true); as demais, false.
  v_empresa_index := 0;
  for v_empresa in select * from jsonb_array_elements(payload->'empresas')
  loop
    select id into v_cliente_id
    from clientes
    where cpf_cnpj_responsavel = v_empresa->>'cpf_cnpj_responsavel';

    insert into contrato_empresas (contrato_id, cliente_id, eh_principal)
    values (v_contrato_id, v_cliente_id, v_empresa_index = 0)
    on conflict (contrato_id, cliente_id) do update set eh_principal = excluded.eh_principal;

    v_empresa_index := v_empresa_index + 1;
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

  -- 5) pagamentos projetados do cronograma principal — gerados de forma
  -- diferente por tipo_pagamento, cada linha agora leva forma_pagamento.
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
        contrato_id, mes, ano, valor_projetado, data_vencimento, status, forma_pagamento
      ) values (
        v_contrato_id,
        extract(month from v_data_venc)::smallint,
        extract(year from v_data_venc)::int,
        case when i = 0 then v_valor_primeiro else v_valor_mensal end,
        v_data_venc,
        'PROJETADO',
        v_forma_pagamento
      );
    end loop;

  elsif v_tipo_pagamento = 'venda_unica' then
    insert into pagamentos_projetados (
      contrato_id, mes, ano, valor_projetado, data_vencimento, status, forma_pagamento
    ) values (
      v_contrato_id,
      extract(month from v_data_pagamento_unico)::smallint,
      extract(year from v_data_pagamento_unico)::int,
      v_valor_total,
      v_data_pagamento_unico,
      'PROJETADO',
      v_forma_pagamento
    );

  elsif v_tipo_pagamento = 'parcelado' then
    v_numero_parcela := 1;
    for v_parcela in select * from jsonb_array_elements(payload->'pagamento'->'parcelas')
    loop
      insert into pagamentos_projetados (
        contrato_id, mes, ano, valor_projetado, data_vencimento, status, numero_parcela, forma_pagamento
      ) values (
        v_contrato_id,
        extract(month from (v_parcela->>'data')::date)::smallint,
        extract(year from (v_parcela->>'data')::date)::int,
        (v_parcela->>'valor')::numeric,
        (v_parcela->>'data')::date,
        'PROJETADO',
        v_numero_parcela,
        v_parcela->>'forma_pagamento'
      );
      v_numero_parcela := v_numero_parcela + 1;
    end loop;
  end if;

  -- 6) Entrada do Contrato — bloco novo e independente do tipo_pagamento
  -- (payload->'pagamento'->'entrada' só existe se o usuário marcou "tem
  -- entrada" no formulário). 1 a 5 linhas com eh_entrada=true e numeração
  -- própria (1..N dentro do grupo). Ao final, resume em contratos.
  v_entrada := payload->'pagamento'->'entrada';
  if v_entrada is not null and jsonb_typeof(v_entrada->'parcelas') = 'array' then
    v_numero_entrada := 1;
    for v_entrada_parcela in select * from jsonb_array_elements(v_entrada->'parcelas')
    loop
      insert into pagamentos_projetados (
        contrato_id, mes, ano, valor_projetado, data_vencimento, status,
        numero_parcela, forma_pagamento, eh_entrada
      ) values (
        v_contrato_id,
        extract(month from (v_entrada_parcela->>'data')::date)::smallint,
        extract(year from (v_entrada_parcela->>'data')::date)::int,
        (v_entrada_parcela->>'valor')::numeric,
        (v_entrada_parcela->>'data')::date,
        'PROJETADO',
        v_numero_entrada,
        v_entrada_parcela->>'forma_pagamento',
        true
      );
      v_numero_entrada := v_numero_entrada + 1;
    end loop;

    update contratos
    set valor_entrada = (
          select sum(valor_projetado) from pagamentos_projetados
          where contrato_id = v_contrato_id and eh_entrada
        ),
        data_entrada = (
          select min(data_vencimento) from pagamentos_projetados
          where contrato_id = v_contrato_id and eh_entrada
        )
    where id = v_contrato_id;
  end if;

  return jsonb_build_object('cliente_id', v_primeira_empresa_id, 'contrato_id', v_contrato_id);
end;
$$;

grant execute on function criar_contrato_completo(jsonb) to anon, authenticated;

-- Confira depois de rodar:
--   select column_name from information_schema.columns where table_name = 'pagamentos_projetados' and column_name in ('forma_pagamento','eh_entrada');
--   select conname, pg_get_constraintdef(oid) from pg_constraint where conname like '%forma_pagamento%';
