-- ROMA BC — Fase 1 — Migration: Ajustes de catálogo (exclusões, rename,
-- Lauri + Tainara na Reforma/Diagnóstico Tributário)
--
-- Pedido do usuário, confirmado que os 2 produtos a excluir têm 0
-- contratos vinculados (conferido antes de escrever isto):
--   - Exclui "BPO" (Roma 35) — já existe "BPO FINANCEIRO" (Roma 35).
--   - Exclui "PARCEIROS - COMISSAO" (Roma 35) — não é mais necessário.
--   - Renomeia "PROJETOS C/ PRAZO DETERMINADO" (Roma 20) para "PROJETOS
--     ESPECIAIS C/ PRAZO DETERMINADO".
--   - Lauri (nova consultora) + Tainara Muller passam a atender
--     Consultoria Reforma Tributária e Diagnóstico Tributário (Roma 20).
--     Tainara mantém Consultoria Financeira/GREEN+ que já tinha — o
--     produtos dela é substituído pelas 4 juntas, não só as 2 novas.
--
-- Execute no SQL Editor do Supabase. Idempotente.

delete from produtos where nome = 'BPO' and une_id = (select id from unes where nome ilike 'Roma 35');

delete from produtos where nome = 'PARCEIROS - COMISSAO' and une_id = (select id from unes where nome ilike 'Roma 35');

update produtos
set nome = 'PROJETOS ESPECIAIS C/ PRAZO DETERMINADO'
where nome = 'PROJETOS C/ PRAZO DETERMINADO' and une_id = (select id from unes where nome ilike 'Roma 20');

do $$
declare
  v_reforma_id uuid;
  v_diagnostico_id uuid;
  v_lauri_id uuid;
begin
  select id into v_reforma_id from produtos where upper(nome) = 'CONSULTORIA REFORMA TRIBUTÁRIA';
  select id into v_diagnostico_id from produtos where upper(nome) = 'DIAGNÓSTICO TRIBUTÁRIO';

  if v_reforma_id is null or v_diagnostico_id is null then
    raise exception 'Produto "CONSULTORIA REFORMA TRIBUTÁRIA" ou "DIAGNÓSTICO TRIBUTÁRIO" não encontrado — confira os nomes antes de rodar esta migration de novo';
  end if;

  select id into v_lauri_id from consultoras where nome = 'Lauri';
  if v_lauri_id is null then
    insert into consultoras (nome, email, produtos)
    values ('Lauri', 'lauri@romabc.com.br', array[v_reforma_id, v_diagnostico_id]);
  else
    update consultoras set produtos = array[v_reforma_id, v_diagnostico_id] where id = v_lauri_id;
  end if;
end $$;

update consultoras
set produtos = (
  select coalesce(array_agg(id), '{}') from produtos
  where upper(nome) in ('CONSULTORIA FINANCEIRA', 'CONSULTORIA GREEN+', 'CONSULTORIA REFORMA TRIBUTÁRIA', 'DIAGNÓSTICO TRIBUTÁRIO')
)
where nome = 'Tainara Muller';

-- Confira depois de rodar:
--   select nome, une_id from produtos order by nome; -- BPO e PARCEIROS - COMISSAO não devem mais aparecer
--   select nome, produtos from consultoras where nome in ('Lauri', 'Tainara Muller') order by nome;
