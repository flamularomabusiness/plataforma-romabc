-- ROMA BC — Fase 1 — Migration: Import de Dados via Excel
--
-- Cria a tabela importacoes (log de auditoria — sucesso e erro, gravado pela
-- API route, não pela função abaixo: se a função der raise exception, TODO o
-- que ela fez é revertido, incluindo qualquer log que ela mesma tentasse
-- gravar. Por isso o log de auditoria é responsabilidade de quem CHAMA a
-- função, não dela — assim uma importação que falha também fica registrada.)
-- e a função importar_dados_excel(payload), que roda a importação inteira
-- numa única transação: qualquer erro (UNE/Produto não encontrado, empresa de
-- pagamento não encontrada, status inválido, valor/data mal formatado) reverte
-- TUDO (nenhum cliente/contrato/pagamento fica inserido pela metade).
--
-- Verificado contra o banco antes de escrever esta migration: contratos não
-- exige consultora_id nem contexto_perfil_cliente (ambos aceitam null/default
-- vazio) — só cliente_id, produto_id e une_id são obrigatórios de fato, então
-- o formato simplificado do Excel (sem consultora, sem pessoas) é suficiente.
--
-- Execute no SQL Editor do Supabase. Idempotente.

create table if not exists importacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_role text not null,
  nome_arquivo text not null,
  clientes_importados int not null default 0,
  pagamentos_importados int not null default 0,
  status text not null check (status in ('SUCESSO', 'ERRO')),
  detalhes jsonb,
  data_criacao timestamptz not null default now()
);

create index if not exists idx_importacoes_data_criacao on importacoes (data_criacao desc);
create index if not exists idx_importacoes_role_data on importacoes (usuario_role, data_criacao desc);

alter table importacoes disable row level security;

create or replace function importar_dados_excel(payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_cliente jsonb;
  v_pagamento jsonb;
  v_idx int;
  v_cliente_id uuid;
  v_une_id uuid;
  v_produto_id uuid;
  v_contrato_id uuid;
  v_data_inicio date;
  v_dia_vencimento smallint;
  v_clientes_count int := 0;
  v_pagamentos_count int := 0;
  -- nome da empresa (como veio na sheet CLIENTES) -> contrato_id criado/atualizado
  -- nesta mesma execução. Pagamentos só resolvem contra empresas DESTE arquivo.
  v_mapa_contratos jsonb := '{}'::jsonb;
  v_nome_empresa text;
  v_contrato_ref text;
  v_data_vencimento date;
  v_data_pagamento date;
begin
  v_idx := 0;
  for v_cliente in select * from jsonb_array_elements(coalesce(payload->'clientes', '[]'::jsonb))
  loop
    v_idx := v_idx + 1;
    v_nome_empresa := v_cliente->>'empresa';

    select id into v_une_id from unes where upper(nome) = upper(v_cliente->>'une');
    if v_une_id is null then
      raise exception 'Sheet CLIENTES, linha %: UNE "%" não encontrada (empresa: %)',
        v_idx, v_cliente->>'une', v_nome_empresa;
    end if;

    select id into v_produto_id from produtos where upper(nome) = upper(v_cliente->>'produto') and une_id = v_une_id;
    if v_produto_id is null then
      raise exception 'Sheet CLIENTES, linha %: Produto "%" não encontrado na UNE "%" (empresa: %)',
        v_idx, v_cliente->>'produto', v_cliente->>'une', v_nome_empresa;
    end if;

    begin
      v_data_inicio := (v_cliente->>'data_inicio')::date;
    exception when others then
      raise exception 'Sheet CLIENTES, linha %: Data Início inválida "%" (empresa: %)',
        v_idx, v_cliente->>'data_inicio', v_nome_empresa;
    end;

    select id into v_cliente_id from clientes where cpf_cnpj_responsavel = v_cliente->>'cnpj';
    if v_cliente_id is null then
      insert into clientes (nome_razao_social, cpf_cnpj_responsavel, status, ativo)
      values (v_nome_empresa, v_cliente->>'cnpj', v_cliente->>'status', true)
      returning id into v_cliente_id;
    else
      update clientes set
        nome_razao_social = v_nome_empresa,
        status = v_cliente->>'status',
        data_atualizacao = now()
      where id = v_cliente_id;
    end if;

    v_dia_vencimento := extract(day from v_data_inicio)::smallint;

    insert into contratos (
      cliente_id, produto_id, une_id, valor_mensal, data_inicio_primeiro_pagamento,
      data_vencimento_mensal, plano_contratado, tipo_pagamento, status
    ) values (
      v_cliente_id, v_produto_id, v_une_id, (v_cliente->>'valor')::numeric, v_data_inicio,
      v_dia_vencimento, 'Padrão', 'recorrente', 'ativo'
    )
    returning id into v_contrato_id;

    insert into contrato_empresas (contrato_id, cliente_id) values (v_contrato_id, v_cliente_id);

    v_mapa_contratos := jsonb_set(v_mapa_contratos, array[v_nome_empresa], to_jsonb(v_contrato_id::text));
    v_clientes_count := v_clientes_count + 1;
  end loop;

  v_idx := 0;
  for v_pagamento in select * from jsonb_array_elements(coalesce(payload->'pagamentos', '[]'::jsonb))
  loop
    v_idx := v_idx + 1;
    v_nome_empresa := v_pagamento->>'empresa';
    v_contrato_ref := v_mapa_contratos->>v_nome_empresa;
    if v_contrato_ref is null then
      raise exception 'Sheet PAGAMENTOS, linha %: empresa "%" não encontrada na sheet CLIENTES deste arquivo',
        v_idx, v_nome_empresa;
    end if;

    begin
      v_data_vencimento := (v_pagamento->>'data_vencimento')::date;
    exception when others then
      raise exception 'Sheet PAGAMENTOS, linha %: Data Vencimento inválida "%" (empresa: %)',
        v_idx, v_pagamento->>'data_vencimento', v_nome_empresa;
    end;

    v_data_pagamento := nullif(v_pagamento->>'data_pagamento', '');
    if v_pagamento->>'status' = 'PAGO' and v_data_pagamento is null then
      raise exception 'Sheet PAGAMENTOS, linha %: status PAGO exige Data Pagamento (empresa: %)',
        v_idx, v_nome_empresa;
    end if;

    insert into pagamentos_projetados (
      contrato_id, mes, ano, valor_projetado, data_vencimento, status, data_pagamento_real
    ) values (
      v_contrato_ref::uuid,
      extract(month from v_data_vencimento)::smallint,
      extract(year from v_data_vencimento)::int,
      (v_pagamento->>'valor')::numeric,
      v_data_vencimento,
      v_pagamento->>'status',
      nullif(v_pagamento->>'data_pagamento', '')::date
    );
    v_pagamentos_count := v_pagamentos_count + 1;
  end loop;

  return jsonb_build_object(
    'clientes_importados', v_clientes_count,
    'pagamentos_importados', v_pagamentos_count
  );
end;
$$;

grant execute on function importar_dados_excel(jsonb) to anon, authenticated;
