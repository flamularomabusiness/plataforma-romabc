-- ROMA BC — Fase 1 — Migration: Corrigir FK faltante contratos.consultora_id
--
-- BUG ENCONTRADO EM PRODUÇÃO: a tela de detalhe do cliente
-- (fetchClienteDetalhes, lib/queries.ts) sempre usou o embed do PostgREST
-- `consultora:consultoras(*)` dentro de `contratos(*, ...)` — isso só
-- funciona se existir uma foreign key de verdade entre as duas tabelas.
-- `contratos` nunca teve essa FK. O PostgREST retornava "PGRST200 — Could
-- not find a relationship between 'contratos' and 'consultoras'", e a tela
-- de detalhe quebrava com "Cliente não encontrado" (a lista de clientes
-- não usa esse embed, por isso continuava funcionando normalmente).
--
-- HISTÓRICO DE TENTATIVAS ANTERIORES (nenhuma tocou o banco de verdade —
-- cada uma revelou uma peça a mais do quebra-cabeça, testando direto
-- contra produção):
--   1) assumi que consultora_id (em contratos) seria text — errado, já era uuid.
--   2) assumi então que o mismatch era só isso — errado: quem é text é
--      consultoras.id, a PK da tabela (única do projeto sem PK uuid).
--   3) tentei converter consultoras.id sozinha — quebrou, porque JÁ EXISTE
--      uma FK de clientes pra consultoras (clientes_consultora_id_fkey),
--      criada fora deste repositório, e ela também é text.
--   4) consultando pg_constraint direto em produção: consultoras.id é
--      referenciada por TRÊS tabelas, não só clientes —
--      clientes.consultora_id, reunioes.consultora_id e
--      agendamentos_fixos.consultora_id (reunioes/agendamentos_fixos não
--      fazem parte deste repositório — são de outra feature/app usando o
--      mesmo projeto Supabase). Todas as três em text.
--
-- Não dá pra converter um lado (referenciado ou referenciante) por vez com
-- a FK existente no meio — o Postgres revalida a constraint nos dois
-- sentidos e quebra de qualquer jeito. A única forma correta: remover as 3
-- FKs existentes, converter TODAS as colunas envolvidas (as 3 + a própria
-- consultoras.id) na mesma transação, recriar as 3 originais do jeito que
-- já estavam (mesmo nome, sem CASCADE — nenhuma tinha ON DELETE explícito
-- nos resultados de pg_get_constraintdef) e só então adicionar a nova FK
-- de contratos, que é o motivo de tudo isso.
--
-- Corrige adicionando a FK que sempre devia ter existido. Depois de rodar,
-- NENHUMA mudança de código é necessária — a query já embeda consultoras
-- certo, só faltava o banco saber que essa relação existe.
--
-- Execute no SQL Editor do Supabase. Idempotente.

do $$
declare
  v_tipo_atual text;
  v_invalidos int;
  v_pendencias text := '';
begin
  select data_type into v_tipo_atual
  from information_schema.columns
  where table_name = 'consultoras' and column_name = 'id';

  if v_tipo_atual = 'text' or v_tipo_atual = 'character varying' then

    -- 1) consultoras órfãs com id fora do formato de UUID — provado seguro
    -- reatribuir (contratos.consultora_id já é uuid, não há como um
    -- contrato apontar pra um id que nem é UUID).
    select count(*) into v_invalidos
    from consultoras
    where id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

    if v_invalidos > 0 then
      raise notice '% consultora(s) com id fora do formato de UUID — gerando id novo pra cada uma.', v_invalidos;
      update consultoras set id = gen_random_uuid()::text
      where id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    end if;

    -- 2) As 3 colunas que JÁ referenciam consultoras.id — aqui não dá pra
    -- só regenerar (podem ser referências reais de clientes/reuniões/
    -- agendamentos de negócio) — se algo estiver fora do formato de UUID,
    -- para com uma lista clara em vez de adivinhar.
    if exists (select 1 from clientes where consultora_id is not null and consultora_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
      v_pendencias := v_pendencias || 'clientes.consultora_id; ';
    end if;
    if exists (select 1 from reunioes where consultora_id is not null and consultora_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
      v_pendencias := v_pendencias || 'reunioes.consultora_id; ';
    end if;
    if exists (select 1 from agendamentos_fixos where consultora_id is not null and consultora_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
      v_pendencias := v_pendencias || 'agendamentos_fixos.consultora_id; ';
    end if;

    if v_pendencias <> '' then
      raise exception
        'Existem valores fora do formato de UUID em: %. Corrija manualmente antes de rodar esta migration de novo (não são consultoras órfãs — podem ser referências reais de negócio).',
        v_pendencias;
    end if;

    -- 3) Remove as 3 FKs existentes (senão a conversão de tipo quebra dos
    -- dois lados), converte tudo pra uuid, recria exatamente como estavam.
    alter table clientes drop constraint clientes_consultora_id_fkey;
    alter table reunioes drop constraint reunioes_consultora_id_fkey;
    alter table agendamentos_fixos drop constraint agendamentos_fixos_consultora_id_fkey;

    alter table consultoras alter column id type uuid using id::uuid;
    alter table consultoras alter column id set default gen_random_uuid();

    alter table clientes alter column consultora_id type uuid using consultora_id::uuid;
    alter table reunioes alter column consultora_id type uuid using consultora_id::uuid;
    alter table agendamentos_fixos alter column consultora_id type uuid using consultora_id::uuid;

    alter table clientes add constraint clientes_consultora_id_fkey
      foreign key (consultora_id) references consultoras (id);
    alter table reunioes add constraint reunioes_consultora_id_fkey
      foreign key (consultora_id) references consultoras (id);
    alter table agendamentos_fixos add constraint agendamentos_fixos_consultora_id_fkey
      foreign key (consultora_id) references consultoras (id);
  end if;

  -- Único contrato órfão encontrado testando contra produção (id fixo,
  -- achado via diagnóstico manual): "IMPERE CONSULTORIA E EXPANSAO DE
  -- NEGOCIOS LTDA", produto CFO MENTORIA (Roma 35) — apontava pra uma
  -- consultora apagada do banco. Confirmado com o usuário: reatribuir pra
  -- Rosane Machado (CFO). Produto não é de consultoria financeira, então
  -- não precisa entrar no array consultoras.produtos (esse filtro é só
  -- pros produtos de consultoria).
  update contratos
  set consultora_id = (select id from consultoras where nome = 'Rosane Machado')
  where id = 'fd0227f3-771b-4020-8324-884d2e2eb414'
    and not exists (select 1 from consultoras where id = contratos.consultora_id);

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
--   select conname, tabela_referenciando, definicao from (
--     select con.conname, cl.relname as tabela_referenciando, pg_get_constraintdef(con.oid) as definicao
--     from pg_constraint con join pg_class cl on cl.oid = con.conrelid
--     where con.confrelid = 'consultoras'::regclass or con.conname = 'contratos_consultora_id_fkey'
--   ) t;
-- Deve aparecer 4 linhas: clientes, reunioes, agendamentos_fixos e contratos, todas uuid.
