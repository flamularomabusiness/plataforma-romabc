-- ROMA BC — Fase 1 — Migration: Corrigir FK faltante contratos.consultora_id
--
-- BUG ENCONTRADO EM PRODUÇÃO: a tela de detalhe do cliente
-- (fetchClienteDetalhes, lib/queries.ts) sempre usou o embed do PostgREST
-- `consultora:consultoras(*)` dentro de `contratos(*, ...)` — isso só
-- funciona se existir uma foreign key de verdade entre as duas tabelas.
-- Conferido direto no banco (pg_constraint): `contratos` só tem FK pra
-- clientes, produtos e unes — `consultora_id` sempre foi uma coluna solta,
-- sem constraint nenhuma. O PostgREST retornava "PGRST200 — Could not find
-- a relationship between 'contratos' and 'consultoras'", e a tela de
-- detalhe quebrava com "Cliente não encontrado" (a lista de clientes não
-- usa esse embed, por isso continuava funcionando normalmente).
--
-- 2ª TENTATIVA (a 1ª falhou): consultora_id não é uuid como as outras 3
-- colunas de FK (cliente_id/produto_id/une_id) — é TEXT. Uma foreign key
-- exige os dois lados com o MESMO tipo (não dá pra "resolver com cast" na
-- própria constraint, só numa comparação avulsa) — então antes da FK esta
-- migration troca o tipo da coluna pra uuid de verdade.
--
-- Corrige adicionando a FK que sempre devia ter existido. Depois de rodar,
-- NENHUMA mudança de código é necessária — a query já embeda consultoras
-- certo, só faltava o banco saber que essa relação existe.
--
-- Passos, em ordem (pra falhar cedo e com mensagem clara em vez de travar
-- no meio com um erro genérico do Postgres):
--   1) confere que todo consultora_id já está no formato de UUID (senão o
--      ALTER COLUMN ... TYPE uuid do passo 3 quebra);
--   2) confere que nenhum UUID válido aponta pra uma consultora inexistente
--      (senão a FK do passo 4 quebra);
--   3) troca o tipo da coluna de text pra uuid;
--   4) adiciona a FK.
--
-- Execute no SQL Editor do Supabase. Idempotente.

do $$
declare
  v_invalidos int;
  v_orfaos int;
  v_tipo_atual text;
begin
  select data_type into v_tipo_atual
  from information_schema.columns
  where table_name = 'contratos' and column_name = 'consultora_id';

  if v_tipo_atual = 'text' or v_tipo_atual = 'character varying' then
    select count(*) into v_invalidos
    from contratos
    where consultora_id is not null
      and consultora_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

    if v_invalidos > 0 then
      raise exception
        'Existem % contrato(s) com consultora_id que não está no formato de UUID — rode "select id, consultora_id from contratos where consultora_id is not null and consultora_id !~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'';" pra ver quais, e corrija antes de rodar esta migration de novo.',
        v_invalidos;
    end if;

    select count(*) into v_orfaos
    from contratos c
    where c.consultora_id is not null
      and not exists (select 1 from consultoras co where co.id = c.consultora_id::uuid);

    if v_orfaos > 0 then
      raise exception
        'Existem % contrato(s) com consultora_id que não corresponde a nenhuma consultora — rode "select id, consultora_id from contratos c where consultora_id is not null and not exists (select 1 from consultoras co where co.id = c.consultora_id::uuid);" pra ver quais, e corrija (ex.: apontando pra uma consultora ativa) antes de rodar esta migration de novo.',
        v_orfaos;
    end if;

    alter table contratos alter column consultora_id type uuid using consultora_id::uuid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contratos_consultora_id_fkey'
  ) then
    alter table contratos
      add constraint contratos_consultora_id_fkey
      foreign key (consultora_id) references consultoras (id)
      on delete restrict;
  end if;
end $$;

-- Confira depois de rodar:
--   select data_type from information_schema.columns where table_name = 'contratos' and column_name = 'consultora_id';
-- Deve aparecer 'uuid'.
--   select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'contratos'::regclass and contype = 'f';
-- Deve aparecer contratos_consultora_id_fkey na lista, junto das outras 3.
