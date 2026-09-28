-- ROMA BC — Fase 1 — Migration: Corrigir FK faltante contratos.consultora_id
--
-- BUG ENCONTRADO EM PRODUÇÃO: a tela de detalhe do cliente
-- (fetchClienteDetalhes, lib/queries.ts) sempre usou o embed do PostgREST
-- `consultora:consultoras(*)` dentro de `contratos(*, ...)` — isso só
-- funciona se existir uma foreign key de verdade entre as duas tabelas.
-- Conferido direto no banco (pg_constraint): `contratos` só tem FK pra
-- clientes, produtos e unes — `consultora_id` sempre foi uma coluna uuid
-- solta, sem constraint nenhuma. O PostgREST retornava
-- "PGRST200 — Could not find a relationship between 'contratos' and
-- 'consultoras'", e a tela de detalhe quebrava com "Cliente não
-- encontrado" (a lista de clientes não usa esse embed, por isso continuava
-- funcionando normalmente).
--
-- Corrige adicionando a FK que sempre devia ter existido. Depois de rodar,
-- NENHUMA mudança de código é necessária — a query já embeda consultoras
-- certo, só faltava o banco saber que essa relação existe.
--
-- Antes de adicionar a constraint, checa se já existe algum contrato com
-- consultora_id órfão (apontando pra uma consultora que não existe mais) —
-- se existir, o ALTER TABLE falharia com um erro genérico do Postgres; em
-- vez disso, para com uma mensagem clara e a query de diagnóstico pronta
-- pra você rodar antes de tentar de novo.
--
-- Execute no SQL Editor do Supabase. Idempotente.

do $$
declare
  v_orfaos int;
begin
  select count(*) into v_orfaos
  from contratos c
  where c.consultora_id is not null
    and not exists (select 1 from consultoras co where co.id = c.consultora_id);

  if v_orfaos > 0 then
    raise exception
      'Existem % contrato(s) com consultora_id que não corresponde a nenhuma consultora — rode "select id, consultora_id from contratos c where consultora_id is not null and not exists (select 1 from consultoras co where co.id = c.consultora_id);" pra ver quais, e corrija (ex.: apontando pra uma consultora ativa) antes de rodar esta migration de novo.',
      v_orfaos;
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
--   select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'contratos'::regclass and contype = 'f';
-- Deve aparecer contratos_consultora_id_fkey na lista, junto das outras 3.
