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
-- CORREÇÃO 1 (bug: contrato recorrente importado só gerava 1 pagamento):
-- todo contrato criado por aqui é sempre tipo_pagamento = 'recorrente' (linha
-- logo abaixo do insert em contratos), mas a função só inserida os pagamentos
-- que vinham na sheet PAGAMENTOS — se o usuário listasse só 1 linha por
-- empresa (em vez de 12, uma por mês), só 1 pagamento era criado. Corrigido
-- gerando as 12 parcelas mensais automaticamente (mesmo cálculo de data —
-- respeita o dia do mês de data_inicio, com fallback pro último dia em meses
-- mais curtos — já usado em criar_contrato_completo, migration_tipo_pagamento.sql)
-- assim que cada contrato é criado.
--
-- CORREÇÃO 2 (bug: import gerava 13 parcelas em vez de 12): a primeira versão
-- desta correção deixava a sheet PAGAMENTOS inserir uma parcela NOVA quando a
-- Data Vencimento da linha não batia com nenhum dos 12 meses já gerados — na
-- prática, isso permitia uma 13ª parcela sempre que a planilha ainda trouxesse
-- uma linha de mês fora da janela do contrato (testado e reproduzido: 12
-- meses gerados + 1 linha da sheet num mês não coberto = 13 pagamentos).
-- Corrigido: uma linha da sheet PAGAMENTOS agora só pode ATUALIZAR uma das 12
-- parcelas já geradas (ex.: marcar um mês específico como PAGO, com data
-- real) — se a Data Vencimento não cair em nenhum dos 12 meses do contrato, a
-- importação inteira é barrada com um erro claro, em vez de silenciosamente
-- virar uma 13ª parcela ou ser ignorada.
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
  v_valor_mensal numeric(14, 2);
  v_data_venc date;
  v_dias_no_mes int;
  v_pagamento_existente_id uuid;
  i int;
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

    -- Contrato importado é sempre 'recorrente' (ver insert acima) — gera as
    -- 12 parcelas mensais projetadas aqui, na hora da criação. A sheet
    -- PAGAMENTOS (loop abaixo) pode depois sobrescrever qualquer uma destas
    -- (ex.: marcar um mês como já PAGO), mas nunca precisa mais trazer as 12
    -- linhas manualmente pra o contrato ganhar seus pagamentos.
    v_valor_mensal := (v_cliente->>'valor')::numeric;
    for i in 0..11 loop
      if i = 0 then
        v_data_venc := v_data_inicio;
      else
        v_dias_no_mes := extract(
          day from (
            date_trunc('month', v_data_inicio + (i || ' months')::interval) + interval '1 month - 1 day'
          )
        )::int;
        v_data_venc := date_trunc('month', v_data_inicio + (i || ' months')::interval)::date
                       + (least(v_dia_vencimento, v_dias_no_mes) - 1);
      end if;

      insert into pagamentos_projetados (
        contrato_id, mes, ano, valor_projetado, data_vencimento, status
      ) values (
        v_contrato_id,
        extract(month from v_data_venc)::smallint,
        extract(year from v_data_venc)::int,
        v_valor_mensal,
        v_data_venc,
        'PROJETADO'
      );
      v_pagamentos_count := v_pagamentos_count + 1;
    end loop;
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

    -- O contrato já ganhou EXATAMENTE 12 parcelas PROJETADAS no loop de
    -- CLIENTES acima (uma por mês, a partir de data_inicio). Uma linha da
    -- sheet PAGAMENTOS só pode ATUALIZAR uma dessas 12 (ex.: marcar um mês
    -- específico como PAGO com data real) — nunca criar uma 13ª parcela.
    -- Se a Data Vencimento da linha não cair em nenhum dos 12 meses gerados
    -- pro contrato daquela empresa, é sinal de planilha desalinhada com
    -- data_inicio (ex.: sheet ainda tem uma linha de um mês fora do intervalo
    -- do contrato) — melhor barrar a importação inteira (raise, como as
    -- outras validações desta função) do que silenciosamente virar um 13º
    -- pagamento ou ficar perdido sem nenhum efeito.
    select id into v_pagamento_existente_id
    from pagamentos_projetados
    where contrato_id = v_contrato_ref::uuid
      and mes = extract(month from v_data_vencimento)::smallint
      and ano = extract(year from v_data_vencimento)::int;

    if v_pagamento_existente_id is null then
      raise exception 'Sheet PAGAMENTOS, linha %: Data Vencimento "%" (empresa: %) não corresponde a nenhum dos 12 meses gerados automaticamente para este contrato a partir da Data Início — ajuste a data para um mês dentro desse intervalo',
        v_idx, to_char(v_data_vencimento, 'DD/MM/YYYY'), v_nome_empresa;
    end if;

    update pagamentos_projetados set
      valor_projetado = (v_pagamento->>'valor')::numeric,
      data_vencimento = v_data_vencimento,
      status = v_pagamento->>'status',
      data_pagamento_real = nullif(v_pagamento->>'data_pagamento', '')::date
    where id = v_pagamento_existente_id;
  end loop;

  return jsonb_build_object(
    'clientes_importados', v_clientes_count,
    'pagamentos_importados', v_pagamentos_count
  );
end;
$$;

grant execute on function importar_dados_excel(jsonb) to anon, authenticated;
