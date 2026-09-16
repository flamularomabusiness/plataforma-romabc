-- ROMA BC — Fase 1 — Migration: Múltiplas Empresas (nº do grupo + empresa principal)
--
-- Duas peças novas, decididas com o usuário ao construir esta feature:
--
-- 1) contratos.numero_empresas — um número SOLTO, digitado à parte no
--    formulário ("Quantas empresas estão naquele grupo?"), independente da
--    contagem real de linhas em contrato_empresas. Ex.: o vendedor pode saber
--    que o grupo tem 5 empresas mas só cadastrar os dados de 2 por enquanto —
--    o número não precisa bater com a lista. Editável depois (tela Editar
--    Cliente, junto dos outros campos do contrato).
--
-- 2) contrato_empresas.eh_principal — qual empresa é a "principal" do grupo
--    (usada pro faturamento/destaque no painel), no mesmo padrão que já existe
--    em pessoas_cliente.eh_principal: um boolean por linha, no máximo uma
--    marcada por contrato (reforçado pelo índice único parcial abaixo), e
--    TROCÁVEL depois via botão "Marcar como principal" — decisão confirmada
--    com o usuário, não fica travada na 1ª empresa cadastrada.
--
-- Antes desta migration a única coisa parecida com "principal" era
-- contratos.cliente_id (a coluna legada, que sempre guarda a 1ª empresa do
-- array no momento da criação) — é o que usamos pra backfill abaixo, mas a
-- partir de agora eh_principal é a fonte de verdade e pode ser alterada.
--
-- Execute no SQL Editor do Supabase. Idempotente.

-- faturamento_medio de pessoas_cliente era NOT NULL — mas esta tarefa torna o
-- campo opcional no formulário (empresa e pessoa), e o valor omitido chega
-- aqui como null (nullif(...) na RPC). Sem isto, criar_contrato_completo
-- falha com "null value ... violates not-null constraint" assim que alguém
-- deixar o Faturamento Médio da pessoa em branco (confirmado testando direto
-- contra o banco). clientes.faturamento_medio já era nullable, não precisou
-- do mesmo ajuste.
alter table pessoas_cliente alter column faturamento_medio drop not null;

alter table contratos add column if not exists numero_empresas integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contratos_numero_empresas_check'
  ) then
    alter table contratos
      add constraint contratos_numero_empresas_check check (numero_empresas >= 1);
  end if;
end $$;

alter table contrato_empresas add column if not exists eh_principal boolean not null default false;

-- Backfill: marca principal a linha que corresponde à coluna legada
-- contratos.cliente_id (a "1ª empresa" de quando o contrato foi criado).
update contrato_empresas ce
set eh_principal = true
from contratos c
where ce.contrato_id = c.id
  and ce.cliente_id = c.cliente_id
  and not exists (
    select 1 from contrato_empresas ce2
    where ce2.contrato_id = ce.contrato_id and ce2.eh_principal
  );

-- Caso de borda: contrato com uma única empresa vinculada mas que, por
-- alguma inconsistência de dados antiga, não bateu com o backfill acima
-- (cliente_id divergente) — marca essa única empresa como principal, já que
-- não há ambiguidade possível.
update contrato_empresas ce
set eh_principal = true
where not exists (
    select 1 from contrato_empresas ce2
    where ce2.contrato_id = ce.contrato_id and ce2.eh_principal
  )
  and (select count(*) from contrato_empresas ce3 where ce3.contrato_id = ce.contrato_id) = 1;

-- Garante no máximo 1 principal por contrato (índice único parcial).
create unique index if not exists idx_contrato_empresas_uma_principal
  on contrato_empresas (contrato_id)
  where eh_principal;

-- Recria criar_contrato_completo: idêntica à versão de
-- migration_tipo_pagamento.sql, só acrescentando numero_empresas (lido do
-- payload, default 1) e marcando a 1ª empresa do array como principal ao
-- ligar em contrato_empresas.
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
  v_numero_empresas int;
  v_data_venc date;
  v_dias_no_mes int;
  v_numero_parcela smallint;
  v_empresa_index int;
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
    v_valor_entrada,
    v_data_entrada,
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

-- ---------------------------------------------------------------------------
-- Responsáveis (tabela consultoras): remove Valmir/Barbara Lima (desativa,
-- não apaga — sem contratos vinculados hoje, mas preserva histórico se algum
-- dia tiverem tido), adiciona Elisa/Glaucia/Mayla/Rosane Machado, e uma
-- coluna "especialidade" pra exibir "Nome (tipo)" no formulário.
-- ---------------------------------------------------------------------------

alter table consultoras add column if not exists especialidade text;

update consultoras set ativo = false where nome in ('Valmir', 'Barbara Lima');

update consultoras set especialidade = 'consultoria' where nome in ('Rosane Mello', 'Tainara Muller');

insert into consultoras (nome, setor, ativo, especialidade)
select 'Elisa', 'vendas', true, 'consultoria'
where not exists (select 1 from consultoras where nome = 'Elisa');

insert into consultoras (nome, setor, ativo, especialidade)
select 'Glaucia', 'vendas', true, 'consultoria'
where not exists (select 1 from consultoras where nome = 'Glaucia');

insert into consultoras (nome, setor, ativo, especialidade)
select 'Mayla', 'vendas', true, 'consultoria'
where not exists (select 1 from consultoras where nome = 'Mayla');

insert into consultoras (nome, setor, ativo, especialidade)
select 'Rosane Machado', 'vendas', true, 'CFO'
where not exists (select 1 from consultoras where nome = 'Rosane Machado');

-- Confira depois de rodar:
--   select nome, especialidade, ativo from consultoras order by ativo desc, nome;
--   select column_name from information_schema.columns where table_name = 'contratos' and column_name = 'numero_empresas';
--   select conname from pg_constraint where conname = 'contratos_numero_empresas_check';
--   select indexname from pg_indexes where indexname = 'idx_contrato_empresas_uma_principal';
