-- ROMA BC — Fase 1 — Migration: Projeção Móvel (contratos recorrentes)
--
-- PROBLEMA: contratos 'recorrente' geram exatamente 12 parcelas na criação
-- (loop for i in 0..11 dentro de criar_contrato_completo) e nunca mais
-- nada — não existe cron/RPC nenhuma que estenda o cronograma depois
-- disso. Qualquer contrato recorrente ativo há mais de 12 meses
-- simplesmente fica sem pagamento futuro projetado em
-- pagamentos_projetados, distorcendo o Dashboard Mês a Mês (visão "Ano
-- Vigente"/"Próximo Ano" pra esses contratos).
--
-- SOLUÇÃO: função estender_cronograma_recorrente(), chamada diariamente
-- pelo mesmo cron que já roda atualizar_pagamentos_vencidos()
-- (app/api/cron/atualizar-pagamentos/route.ts). Ela estende o cronograma
-- de cada contrato recorrente ativo até uma "janela-alvo" de "fim do ano
-- atual + 6 meses do ano seguinte" — na prática, isso é sempre
-- 30 de junho do ano seguinte ao ano corrente (constante durante todo o
-- ano corrente inteiro, só avança 12 meses de uma vez em cada 1º de
-- janeiro).
--
-- Não existe coluna que rastreie "até onde o cronograma já foi gerado" —
-- calculado a cada chamada via max(data_vencimento) da própria tabela
-- pagamentos_projetados (excluindo linhas de entrada, que têm numeração e
-- cronograma próprios, independentes do mensal). Isso torna a função
-- idempotente por construção: rodar 2x no mesmo dia não duplica nada,
-- porque a segunda chamada já vê a data mais recente gerada pela primeira.
--
-- Ao final desta migration, `select estender_cronograma_recorrente();` é
-- executado uma vez — isso faz o BACKFILL de todos os contratos
-- recorrentes ATIVOS já existentes em produção (insere as parcelas que
-- faltam até a janela-alvo atual). É uma escrita real em produção — se
-- houver muitos contratos recorrentes antigos, pode gerar bastante linha
-- nova de uma vez só (esperado, não é bug).
--
-- Execute no SQL Editor do Supabase. Idempotente.

create or replace function estender_cronograma_recorrente()
returns integer
language plpgsql
as $$
declare
  v_data_alvo date;
  v_contrato record;
  v_ultima_data date;
  v_dia_vencimento smallint;
  v_forma_pagamento text;
  v_proxima_data date;
  v_dias_no_mes int;
  v_total_inseridas integer := 0;
begin
  -- "Fim do ano atual + 6 meses do ano seguinte" = sempre 30/06 do ano
  -- seguinte ao ano corrente (current_date, não a data de início de cada
  -- contrato — a janela-alvo é a mesma pra todo mundo).
  v_data_alvo := make_date(extract(year from current_date)::int + 1, 6, 30);

  for v_contrato in
    select id, valor_mensal, data_vencimento_mensal, data_inicio_primeiro_pagamento
    from contratos
    where tipo_pagamento = 'recorrente' and status = 'ativo'
  loop
    v_dia_vencimento := v_contrato.data_vencimento_mensal;
    if v_dia_vencimento is null then
      continue; -- contrato recorrente sem dia de vencimento definido — nada a fazer, dado incompleto.
    end if;

    select max(data_vencimento) into v_ultima_data
    from pagamentos_projetados
    where contrato_id = v_contrato.id and not eh_entrada;

    -- Defensivo: contrato criado pela RPC atual sempre tem pelo menos as
    -- 12 parcelas iniciais, então isso não deveria acontecer — mas se
    -- acontecer, usa a data de início como ponto de partida.
    if v_ultima_data is null then
      v_ultima_data := v_contrato.data_inicio_primeiro_pagamento;
    end if;
    if v_ultima_data is null then
      continue; -- sem nenhuma data de referência possível — pula este contrato.
    end if;

    select forma_pagamento into v_forma_pagamento
    from pagamentos_projetados
    where contrato_id = v_contrato.id
    order by data_vencimento desc
    limit 1;

    while v_ultima_data < v_data_alvo loop
      v_dias_no_mes := extract(
        day from (
          date_trunc('month', v_ultima_data + interval '1 month') + interval '1 month - 1 day'
        )
      )::int;
      v_proxima_data := date_trunc('month', v_ultima_data + interval '1 month')::date
                        + (least(v_dia_vencimento, v_dias_no_mes) - 1);

      exit when v_proxima_data > v_data_alvo;

      insert into pagamentos_projetados (
        contrato_id, mes, ano, valor_projetado, data_vencimento, status, forma_pagamento
      ) values (
        v_contrato.id,
        extract(month from v_proxima_data)::smallint,
        extract(year from v_proxima_data)::int,
        v_contrato.valor_mensal,
        v_proxima_data,
        'PROJETADO',
        v_forma_pagamento
      );

      v_total_inseridas := v_total_inseridas + 1;
      v_ultima_data := v_proxima_data;
    end loop;
  end loop;

  return v_total_inseridas;
end;
$$;

grant execute on function estender_cronograma_recorrente() to anon, authenticated;

-- Backfill imediato — estende todos os contratos recorrentes ativos já
-- existentes até a janela-alvo atual. Roda select em vez de "perform" de
-- propósito: o retorno aparece no resultado da query no SQL Editor, pra
-- você ver quantas linhas foram inseridas nesta primeira execução.
select estender_cronograma_recorrente() as parcelas_geradas_no_backfill;

-- Confira depois de rodar:
--   select c.id, c.data_inicio_primeiro_pagamento, max(p.data_vencimento) as ultima_parcela
--   from contratos c join pagamentos_projetados p on p.contrato_id = c.id and not p.eh_entrada
--   where c.tipo_pagamento = 'recorrente' and c.status = 'ativo'
--   group by c.id, c.data_inicio_primeiro_pagamento
--   order by ultima_parcela desc;
-- "ultima_parcela" deve estar próxima de 30/06 do ano seguinte ao atual pra todo mundo.
