-- ROMA BC — Fase 1
-- Schema Supabase (Postgres). Execute no SQL Editor do seu projeto Supabase.
-- Observação: RLS fica desabilitado nesta fase (uso interno, sem autenticação de usuário final).
-- Antes de expor publicamente, habilite RLS e crie políticas adequadas.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- produtos
-- ---------------------------------------------------------------------------
create table if not exists produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);

-- Dados reais (15 produtos) carregados via SQL_DADOS_BASICOS.sql — não duplicar aqui.

-- ---------------------------------------------------------------------------
-- consultoras
-- ---------------------------------------------------------------------------
create table if not exists consultoras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text,
  created_at timestamptz not null default now()
);

-- Dados reais (Rosane Mello, Barbara Lima, Tainara Muller, Valmir) carregados
-- via SQL_DADOS_BASICOS.sql — não duplicar aqui.

-- ---------------------------------------------------------------------------
-- clientes
-- ---------------------------------------------------------------------------
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  cnpj text not null unique,
  cidade text not null,
  estado text not null,
  faturamento_medio numeric(14, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clientes_razao_social on clientes (razao_social);
create index if not exists idx_clientes_cnpj on clientes (cnpj);

-- ---------------------------------------------------------------------------
-- contatos_cliente (já existente conforme especificação — criado aqui de
-- forma idempotente para ambientes novos)
-- ---------------------------------------------------------------------------
create table if not exists contatos_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  nome text not null,
  telefone text not null,
  email text not null,
  funcao text not null check (
    funcao in ('RESPONSAVEL', 'FINANCEIRO', 'SOCIO', 'DONO', 'FUNCIONARIO', 'OUTRO')
  ),
  funcao_outro_descricao text,
  rede_social text,
  data_nascimento date,
  created_at timestamptz not null default now()
);

create index if not exists idx_contatos_cliente_cliente_id on contatos_cliente (cliente_id);

-- ---------------------------------------------------------------------------
-- contratos
-- ---------------------------------------------------------------------------
create table if not exists contratos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  produto_id uuid not null references produtos (id),
  une text not null,
  valor_consultoria numeric(14, 2) not null,
  plano text not null default 'Padrão',
  recorrente boolean not null default true,
  data_primeiro_pagamento date not null,
  valor_primeiro_pagamento numeric(14, 2),
  dia_vencimento smallint not null check (dia_vencimento between 1 and 31),
  data_inicio_consultoria date,
  data_onboarding date,
  consultora_id uuid not null references consultoras (id),
  observacoes text,
  status text not null default 'ativo' check (status in ('ativo', 'inativo', 'cancelado')),
  grau_dificuldade text not null default 'MEDIO' check (
    grau_dificuldade in ('BAIXO', 'MEDIO', 'ALTO')
  ),
  created_at timestamptz not null default now()
);

create index if not exists idx_contratos_cliente_id on contratos (cliente_id);
create index if not exists idx_contratos_status on contratos (status);
create index if not exists idx_contratos_grau_dificuldade on contratos (grau_dificuldade);

-- ---------------------------------------------------------------------------
-- pagamentos_projetados
-- ---------------------------------------------------------------------------
create table if not exists pagamentos_projetados (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contratos (id) on delete cascade,
  numero_parcela smallint not null,
  mes smallint not null check (mes between 1 and 12),
  ano int not null,
  valor_projetado numeric(14, 2) not null,
  data_vencimento date not null,
  status text not null default 'projetado' check (
    status in ('projetado', 'pago', 'atrasado', 'cancelado')
  ),
  created_at timestamptz not null default now()
);

create index if not exists idx_pagamentos_contrato_id on pagamentos_projetados (contrato_id);
create index if not exists idx_pagamentos_mes_ano on pagamentos_projetados (ano, mes);
create index if not exists idx_pagamentos_status on pagamentos_projetados (status);

-- ---------------------------------------------------------------------------
-- criar_contrato_completo: cria/atualiza cliente, contatos, contrato e as
-- 12 parcelas projetadas em uma única chamada RPC. Uma função plpgsql roda
-- dentro da transação implícita da chamada — se qualquer etapa levantar
-- exceção, tudo é revertido automaticamente ("tudo ou nada").
-- ---------------------------------------------------------------------------
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
