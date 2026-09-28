-- ROMA BC — Fase 1 — Migration: Corrige atribuição de Glaucia/Mayla + cria Nathalia
--
-- migration_produtos_planos.sql tinha atribuído Glaucia/Mayla ao BPO
-- Financeiro por engano (erro na descrição original do pedido) — na
-- verdade elas atendem Consultoria Financeira (Roma 20 e GREEN+ Ympuls
-- 46), igual Elisa/Rosane Mello/Tainara Muller. BPO Financeiro hoje só tem
-- a Nathalia, que ainda não existia como consultora.
--
-- Execute no SQL Editor do Supabase. Idempotente.

update consultoras
set produtos = (
  select coalesce(array_agg(id), '{}') from produtos
  where upper(nome) in ('CONSULTORIA FINANCEIRA', 'CONSULTORIA GREEN+')
)
where nome in ('Glaucia', 'Mayla');

do $$
declare
  v_bpo_id uuid;
begin
  select id into v_bpo_id from produtos where upper(nome) = 'BPO FINANCEIRO';
  if v_bpo_id is null then
    raise exception 'Produto "BPO FINANCEIRO" não encontrado — confira o nome real em produtos.nome antes de rodar esta migration';
  end if;

  if not exists (select 1 from consultoras where nome = 'Nathalia') then
    insert into consultoras (nome, email, produtos)
    values ('Nathalia', 'bpo@romabc.com.br', array[v_bpo_id]);
  else
    update consultoras set produtos = array[v_bpo_id] where nome = 'Nathalia';
  end if;
end $$;

-- Confira depois de rodar:
--   select nome, email, produtos from consultoras order by nome;
