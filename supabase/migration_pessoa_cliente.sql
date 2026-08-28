-- ROMA BC — Fase 1 — Migration: Pessoa Cliente (substitui Contatos no formulário)
--
-- CONTEXTO: a tabela pessoas_cliente já existia no banco (criada fora deste
-- projeto), mas com RLS ligado e sem policy de INSERT para a role anon —
-- mesma causa raiz de outras migrations anteriores. Esta migration:
--   1. Desliga RLS em pessoas_cliente (mesmo padrão das outras tabelas da
--      Fase 1 — uso interno, sem autenticação de usuário final ainda).
--   2. Recria criar_contrato_completo(): agora insere em pessoas_cliente
--      (ligada por contrato_id) em vez de contatos_cliente (ligada por
--      cliente_id). contatos_cliente NÃO foi apagada e continua intacta
--      para contratos antigos — só para de receber novos registros.
--
-- Execute no SQL Editor do Supabase. Idempotente.

alter table pessoas_cliente disable row level security;

create or replace function criar_contrato_completo(payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_cliente_id uuid;
  v_contrato_id uuid;
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
    coalesce(payload->>'contexto_perfil_cliente', ''),
    'ativo',
    coalesce(payload->>'grau_dificuldade', 'MEDIO')
  )
  returning id into v_contrato_id;

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

-- Confira: pessoas_cliente deve aparecer com rowsecurity = false.
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'pessoas_cliente';
