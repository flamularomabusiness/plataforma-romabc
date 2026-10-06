-- ROMA BC — Fase 1 — Migration: Import Excel aceita recorrente contínuo
--
-- BUG ENCONTRADO: a validação de Nº Parcela pra tipo_pagamento='recorrente'
-- sempre exigiu uma sequência perfeita 1..N (a partir de 1). Isso fazia
-- sentido no modelo antigo (todo contrato recorrente nascia com exatamente
-- 12 parcelas fixas, tudo de uma vez) — mas com a Projeção Móvel
-- (migration_janela_movel_recorrente.sql, contratos recorrentes agora são
-- contínuos e o cron estende o cronograma indefinidamente), reimportar/
-- continuar as parcelas de um contrato recorrente já em andamento é
-- legítimo, e a planilha pode trazer só as parcelas 5-12 (por exemplo),
-- não 1-12 — isso quebrava com "Nº Parcela inválido (esperado 1-8,
-- faltando 1, 2, 3, 4)".
--
-- CORREÇÃO (só pra tipo 'recorrente' — 'parcelado' e 'venda_unica' não
-- mudam, continuam exigindo sequência 1..N desde o início, que ainda faz
-- sentido pra eles):
--   - Não exige mais começar em 1 — só exige sem duplicata e sem furo
--     (contíguo, qualquer ponto de partida).
--   - Janela de datas: em vez de exigir "dentro de N meses da Data
--     Início" (teto rígido demais pra uma continuação distante no tempo),
--     exige só "não anterior à Data Início" (sanity check básico).
--
-- Único bloco alterado é a validação do tipo 'recorrente' — todo o resto
-- de importar_dados_excel é idêntico à versão em
-- migration_nome_fantasia_import_excel.sql.
--
-- Execute no SQL Editor do Supabase. Idempotente.

create or replace function importar_dados_excel(payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  v_cliente jsonb;
  v_idx int;
  v_cliente_id uuid;
  v_une_id uuid;
  v_produto_id uuid;
  v_contrato_id uuid;
  v_data_inicio date;
  v_dia_vencimento smallint;
  v_clientes_count int := 0;
  v_pagamentos_count int := 0;
  v_nome_empresa text;
  v_tipo_pagamento text;
  v_tipo_bruto text;
  v_numero_parcelas int;
  v_valor_cliente numeric(14, 2);
  -- pagamentos daquela empresa, já ordenados por nro_parcela.
  v_pags_arr jsonb[];
  v_qtd int;
  v_esperado int[];
  v_encontrados int[];
  v_faltando int[];
  v_pag jsonb;
  v_nro int;
  v_data_venc date;
  v_data_pagamento date;
  v_status_pag text;
  v_soma numeric(14, 2);
  v_janela_ini date;
  v_janela_fim date;
  v_data_anterior date;
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

    begin
      v_valor_cliente := (v_cliente->>'valor')::numeric;
    exception when others then
      raise exception 'Sheet CLIENTES, linha %: Valor inválido "%" (empresa: %)',
        v_idx, v_cliente->>'valor', v_nome_empresa;
    end;

    -- Normaliza tipo_pagamento: aceita variações de acento/caixa/espaço na
    -- planilha, mas internamente só existem 3 valores (os mesmos do
    -- formulário de Novo Contrato — 'venda_unica' é o "à vista"). "à" é o
    -- único acento que de fato aparece em algum valor aceito — troca só ele
    -- em vez de um translate() com tabela de acentos genérica (frágil: listas
    -- from/to de tamanhos diferentes corrompem o mapeamento em silêncio).
    v_tipo_bruto := lower(trim(coalesce(v_cliente->>'tipo_pagamento', '')));
    v_tipo_bruto := replace(v_tipo_bruto, 'à', 'a');
    v_tipo_bruto := regexp_replace(v_tipo_bruto, '[\s_-]+', ' ', 'g');

    if v_tipo_bruto = 'recorrente' then
      v_tipo_pagamento := 'recorrente';
    elsif v_tipo_bruto in ('a vista', 'avista', 'venda unica', 'vendaunica') then
      v_tipo_pagamento := 'venda_unica';
    elsif v_tipo_bruto = 'parcelado' then
      v_tipo_pagamento := 'parcelado';
    else
      raise exception 'Sheet CLIENTES, linha %: Tipo Pagamento "%" inválido (empresa: %) — use recorrente, à vista ou parcelado',
        v_idx, v_cliente->>'tipo_pagamento', v_nome_empresa;
    end if;

    v_numero_parcelas := nullif(v_cliente->>'numero_parcelas', '')::int;
    if v_tipo_pagamento = 'parcelado' and (v_numero_parcelas is null or v_numero_parcelas < 1) then
      raise exception 'Sheet CLIENTES, linha %: Número de Parcelas inválido para tipo parcelado (empresa: %)',
        v_idx, v_nome_empresa;
    end if;

    -- Pagamentos desta empresa (de payload->'pagamentos'), ordenados por
    -- nro_parcela. Cast isolado num bloco próprio pra dar um erro claro em
    -- vez de deixar vazar "invalid input syntax for type integer" cru.
    begin
      select array_agg(p order by (p->>'nro_parcela')::int)
      into v_pags_arr
      from jsonb_array_elements(coalesce(payload->'pagamentos', '[]'::jsonb)) p
      where p->>'empresa' = v_nome_empresa;
    exception when others then
      raise exception 'Empresa %: Nº Parcela (nro_parcela) contém valor não numérico em algum pagamento',
        v_nome_empresa;
    end;

    v_qtd := coalesce(array_length(v_pags_arr, 1), 0);

    -- status PAGO exige Data Pagamento — vale pra qualquer tipo, então
    -- verifica aqui, antes de qualquer insert (cliente/contrato inclusive),
    -- em vez de deixar só pro loop final de inserção.
    for i in 1..v_qtd loop
      v_pag := v_pags_arr[i];
      if upper(trim(coalesce(v_pag->>'status', ''))) = 'PAGO' and nullif(v_pag->>'data_pagamento', '') is null then
        raise exception 'Empresa %, linha %: status PAGO exige Data Pagamento', v_nome_empresa, i;
      end if;
    end loop;

    -- =====================================================================
    -- Validação específica por tipo de pagamento.
    -- =====================================================================
    if v_tipo_pagamento = 'recorrente' then
      if v_qtd < 1 then
        raise exception 'Empresa %: tipo recorrente precisa de pelo menos 1 parcela', v_nome_empresa;
      end if;

      -- Não exige mais começar em 1 (contrato recorrente agora é contínuo,
      -- via Projeção Móvel — reimportar/continuar a partir de qualquer
      -- parcela é legítimo). Só exige: sem duplicata e sem furo na
      -- sequência (contígua), qualquer que seja o ponto de partida.
      select array_agg(distinct (p->>'nro_parcela')::int order by (p->>'nro_parcela')::int)
      into v_encontrados
      from unnest(v_pags_arr) p;

      if coalesce(array_length(v_encontrados, 1), 0) != v_qtd then
        raise exception 'Empresa %: Nº Parcela tem valor duplicado (esperado % valores distintos, encontrado %)',
          v_nome_empresa, v_qtd, coalesce(array_length(v_encontrados, 1), 0);
      end if;

      if v_encontrados[array_length(v_encontrados, 1)] - v_encontrados[1] + 1 != v_qtd then
        raise exception 'Empresa %: Nº Parcela tem furo na sequência (valores encontrados: %)',
          v_nome_empresa, array_to_string(v_encontrados, ', ');
      end if;

      -- Janela de datas: só exige que não seja anterior à Data Início
      -- (sanity check básico) — sem teto superior, já que o cronograma
      -- recorrente agora é aberto (sem um "fim" fixo em N meses).
      for i in 1..v_qtd loop
        v_pag := v_pags_arr[i];
        begin
          v_data_venc := (v_pag->>'data_vencimento')::date;
        exception when others then
          raise exception 'Empresa %, linha %: Data Vencimento inválida "%"',
            v_nome_empresa, i, v_pag->>'data_vencimento';
        end;
        if v_data_venc < v_data_inicio then
          raise exception 'Empresa %, linha %: Data Vencimento % é anterior à Data Início %',
            v_nome_empresa, i, to_char(v_data_venc, 'DD/MM/YYYY'), to_char(v_data_inicio, 'DD/MM/YYYY');
        end if;
      end loop;

    elsif v_tipo_pagamento = 'venda_unica' then
      if v_qtd != 1 then
        raise exception 'Empresa %: à vista precisa de exatamente 1 parcela, encontrado %', v_nome_empresa, v_qtd;
      end if;

      v_pag := v_pags_arr[1];
      v_nro := nullif(v_pag->>'nro_parcela', '')::int;
      if v_nro is distinct from 1 then
        raise exception 'Empresa %: Nº Parcela inválido (esperado 1, encontrado %)', v_nome_empresa, v_nro;
      end if;

      begin
        v_data_venc := (v_pag->>'data_vencimento')::date;
      exception when others then
        raise exception 'Empresa %: Data Vencimento inválida "%"', v_nome_empresa, v_pag->>'data_vencimento';
      end;
      if abs(v_data_venc - v_data_inicio) > 5 then
        raise exception 'Empresa %: Data Vencimento % está fora da tolerância de ±5 dias da Data Início %',
          v_nome_empresa, to_char(v_data_venc, 'DD/MM/YYYY'), to_char(v_data_inicio, 'DD/MM/YYYY');
      end if;

    elsif v_tipo_pagamento = 'parcelado' then
      -- Antes exigia bater exatamente com Número de Parcelas (CLIENTES) —
      -- rígido demais quando o real diverge do planejado (14 em vez de 12,
      -- por exemplo). Só exige pelo menos 1; sequência e janela usam o N
      -- real (v_qtd), não o valor declarado em CLIENTES — Número de Parcelas
      -- continua obrigatório na sheet (sanity check de que é um número
      -- válido), mas deixa de precisar bater com a contagem real.
      if v_qtd < 1 then
        raise exception 'Empresa %: tipo parcelado precisa de pelo menos 1 parcela', v_nome_empresa;
      end if;

      select array_agg(gs) into v_esperado from generate_series(1, v_qtd) gs;
      select array_agg(distinct (p->>'nro_parcela')::int order by (p->>'nro_parcela')::int)
      into v_encontrados
      from unnest(v_pags_arr) p;

      if v_encontrados is distinct from v_esperado then
        select array_agg(gs) into v_faltando
        from generate_series(1, v_qtd) gs
        where gs != all(coalesce(v_encontrados, array[]::int[]));
        raise exception 'Empresa %: Nº Parcela inválido (esperado 1-%, faltando %)',
          v_nome_empresa, v_qtd, array_to_string(v_faltando, ', ');
      end if;

      v_janela_ini := v_data_inicio - (v_qtd || ' months')::interval;
      v_janela_fim := v_data_inicio + (v_qtd || ' months')::interval;
      v_data_anterior := null;
      v_soma := 0;

      for i in 1..v_qtd loop
        v_pag := v_pags_arr[i];
        begin
          v_data_venc := (v_pag->>'data_vencimento')::date;
        exception when others then
          raise exception 'Empresa %, linha %: Data Vencimento inválida "%"',
            v_nome_empresa, i, v_pag->>'data_vencimento';
        end;

        if v_data_venc < v_janela_ini or v_data_venc > v_janela_fim then
          raise exception 'Empresa %, linha %: Data Vencimento % está fora da janela % - %',
            v_nome_empresa, i, to_char(v_data_venc, 'DD/MM/YYYY'),
            to_char(v_janela_ini, 'DD/MM/YYYY'), to_char(v_janela_fim, 'DD/MM/YYYY');
        end if;

        if v_data_anterior is not null and v_data_venc <= v_data_anterior then
          raise exception 'Empresa %, linha %: datas das parcelas devem estar em ordem crescente (% não é depois de %)',
            v_nome_empresa, i, to_char(v_data_venc, 'DD/MM/YYYY'), to_char(v_data_anterior, 'DD/MM/YYYY');
        end if;
        v_data_anterior := v_data_venc;

        begin
          v_soma := v_soma + (v_pag->>'valor')::numeric;
        exception when others then
          raise exception 'Empresa %, linha %: Valor inválido "%"', v_nome_empresa, i, v_pag->>'valor';
        end;
      end loop;

      if abs(v_soma - v_valor_cliente) > 0.01 then
        raise exception 'Empresa %: soma das parcelas (%) não bate com valor total (%)',
          v_nome_empresa, v_soma, v_valor_cliente;
      end if;
    end if;

    -- =====================================================================
    -- Validação passou — upsert do cliente e insert do contrato/pagamentos.
    -- =====================================================================
    select id into v_cliente_id from clientes where cpf_cnpj_responsavel = v_cliente->>'cnpj';
    if v_cliente_id is null then
      insert into clientes (nome_razao_social, nome_fantasia, cpf_cnpj_responsavel, status, ativo)
      values (v_nome_empresa, nullif(v_cliente->>'nome_fantasia', ''), v_cliente->>'cnpj', v_cliente->>'status', true)
      returning id into v_cliente_id;
    else
      update clientes set
        nome_razao_social = v_nome_empresa,
        nome_fantasia = nullif(v_cliente->>'nome_fantasia', ''),
        status = v_cliente->>'status',
        data_atualizacao = now()
      where id = v_cliente_id;
    end if;

    v_dia_vencimento := extract(day from v_data_inicio)::smallint;

    insert into contratos (
      cliente_id, produto_id, une_id, plano_contratado, tipo_pagamento, status,
      valor_mensal, data_inicio_primeiro_pagamento, data_vencimento_mensal,
      valor_total, numero_parcelas
    ) values (
      v_cliente_id, v_produto_id, v_une_id, 'Padrão', v_tipo_pagamento, 'ativo',
      case when v_tipo_pagamento = 'recorrente' then v_valor_cliente else null end,
      v_data_inicio,
      case when v_tipo_pagamento = 'recorrente' then v_dia_vencimento else null end,
      v_valor_cliente,
      -- v_qtd (contagem real de linhas), não v_numero_parcelas (o valor
      -- declarado em CLIENTES) — agora que a contagem real não precisa mais
      -- bater com o declarado, gravar o declarado deixaria o contrato
      -- mostrando "parcela X de 12" em algum lugar mesmo tendo só 8 linhas.
      case when v_tipo_pagamento = 'parcelado' then v_qtd else null end
    )
    returning id into v_contrato_id;

    insert into contrato_empresas (contrato_id, cliente_id) values (v_contrato_id, v_cliente_id);
    v_clientes_count := v_clientes_count + 1;

    -- Insere exatamente as linhas de PAGAMENTOS já validadas acima — nenhum
    -- tipo gera parcela sozinho, todos vêm da sheet.
    for i in 1..v_qtd loop
      v_pag := v_pags_arr[i];
      v_data_venc := (v_pag->>'data_vencimento')::date;
      v_data_pagamento := nullif(v_pag->>'data_pagamento', '')::date;

      v_status_pag := upper(trim(coalesce(v_pag->>'status', '')));
      if v_status_pag not in ('PROJETADO', 'PAGO', 'ATRASADO', 'INADIMPLENTE') then
        v_status_pag := 'PROJETADO';
      end if;

      insert into pagamentos_projetados (
        contrato_id, numero_parcela, mes, ano, valor_projetado, data_vencimento, status, data_pagamento_real
      ) values (
        v_contrato_id,
        nullif(v_pag->>'nro_parcela', '')::int,
        extract(month from v_data_venc)::smallint,
        extract(year from v_data_venc)::int,
        (v_pag->>'valor')::numeric,
        v_data_venc,
        v_status_pag,
        v_data_pagamento
      );
      v_pagamentos_count := v_pagamentos_count + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'clientes_importados', v_clientes_count,
    'pagamentos_importados', v_pagamentos_count
  );
end;
$$;

grant execute on function importar_dados_excel(jsonb) to authenticated;
