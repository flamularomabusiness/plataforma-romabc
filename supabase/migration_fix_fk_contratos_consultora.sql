-- ROMA BC — Fase 1 — Migration: Corrigir FK faltante contratos.consultora_id
--
-- BUG ENCONTRADO EM PRODUÇÃO: a tela de detalhe do cliente
-- (fetchClienteDetalhes, lib/queries.ts) sempre usou o embed do PostgREST
-- `consultora:consultoras(*)` dentro de `contratos(*, ...)` — isso só
-- funciona se existir uma foreign key de verdade entre as duas tabelas.
-- Conferido direto no banco (pg_constraint): `contratos` só tem FK pra
-- clientes, produtos e unes — nunca existiu FK pra consultoras. O
-- PostgREST retornava "PGRST200 — Could not find a relationship between
-- 'contratos' and 'consultoras'", e a tela de detalhe quebrava com
-- "Cliente não encontrado" (a lista de clientes não usa esse embed, por
-- isso continuava funcionando normalmente).
--
-- 3ª TENTATIVA (as 2 anteriores erraram o lado): o mismatch de tipo não é
-- em contratos.consultora_id (esse já é uuid, confirmado testando direto
-- contra o banco) — é em **consultoras.id**, a PK da tabela, que é TEXT.
-- `consultoras` é a única tabela do projeto cuja PK não é uuid de verdade
-- (produtos/unes/clientes/contratos todas são). Uma FK exige os dois lados
-- com o mesmo tipo, então esta migration converte consultoras.id pra uuid
-- primeiro — e só então adiciona a constraint.
--
-- Corrige adicionando a FK que sempre devia ter existido. Depois de rodar,
-- NENHUMA mudança de código é necessária — a query já embeda consultoras
-- certo, só faltava o banco saber que essa relação existe.
--
-- 4ª TENTATIVA: 5 consultoras têm id fora do formato de UUID (a checagem
-- do passo 1 pegou isso e parou, como devia). Como contratos.consultora_id
-- JÁ é uuid (confirmado no erro da tentativa anterior), é estruturalmente
-- impossível qualquer contrato apontar pra um id que nem é UUID — o
-- Postgres nunca deixaria gravar esse valor numa coluna uuid. Ou seja,
-- essas 5 linhas são garantidamente órfãs (nenhum contrato as referencia),
-- seguro gerar um uuid novo pra elas em vez de só travar pedindo
-- investigação manual. Mesmo assim, a migration confirma isso de novo
-- explicitamente antes de mexer, em vez de confiar só no raciocínio.
--
-- Passos, em ordem (pra falhar cedo e com mensagem clara em vez de travar
-- no meio com um erro genérico do Postgres):
--   1) confere que nenhum contrato referencia um id fora do formato de
--      UUID (deveria ser sempre verdade, dado que consultora_id é uuid —
--      só uma dupla checagem antes de reatribuir ids);
--   2) dá um uuid novo pras consultoras com id fora do formato;
--   3) troca o tipo da coluna de text pra uuid (e reajusta o default pra
--      gen_random_uuid(), igual toda outra PK do projeto);
--   4) adiciona a FK.
--
-- Execute no SQL Editor do Supabase. Idempotente.

do $$
declare
  v_invalidos int;
  v_referenciados int;
  v_tipo_atual text;
begin
  select data_type into v_tipo_atual
  from information_schema.columns
  where table_name = 'consultoras' and column_name = 'id';

  if v_tipo_atual = 'text' or v_tipo_atual = 'character varying' then
    select count(*) into v_invalidos
    from consultoras
    where id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

    if v_invalidos > 0 then
      select count(*) into v_referenciados
      from contratos c
      join consultoras co on co.id = c.consultora_id::text
      where co.id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

      if v_referenciados > 0 then
        raise exception
          'Inesperado: % contrato(s) referenciam consultora(s) com id fora do formato de UUID — pare e investigue manualmente antes de continuar (não devia ser possível, já que contratos.consultora_id é uuid).',
          v_referenciados;
      end if;

      raise notice '% consultora(s) com id fora do formato de UUID, sem nenhum contrato referenciando — gerando id novo pra cada uma.', v_invalidos;
      update consultoras set id = gen_random_uuid()::text
      where id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    end if;

    alter table consultoras alter column id type uuid using id::uuid;
    alter table consultoras alter column id set default gen_random_uuid();
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
--   select data_type from information_schema.columns where table_name = 'consultoras' and column_name = 'id';
-- Deve aparecer 'uuid'.
--   select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'contratos'::regclass and contype = 'f';
-- Deve aparecer contratos_consultora_id_fkey na lista, junto das outras 3.
