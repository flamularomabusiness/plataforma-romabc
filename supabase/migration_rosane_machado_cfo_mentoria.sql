-- ROMA BC — Fase 1 — Migration: Rosane Machado (CFO Mentoria)
--
-- Rosane Machado não é consultora de Consultoria Financeira/GREEN+ — é
-- mentora só do produto CFO MENTORIA (Roma 35). Por isso o array
-- `produtos` dela é preenchido só com o id desse produto, em vez de ficar
-- vazio (vazio significa "aparece pra qualquer produto" — o que faria ela
-- aparecer indevidamente em Consultoria Financeira/GREEN+/BPO/etc.).
--
-- O contrato da IMPERE CONSULTORIA E EXPANSAO DE NEGOCIOS LTDA (produto
-- CFO Mentoria) ficou com consultora_id nulo depois da migration da FK
-- (migration_fix_fk_contratos_consultora.sql tentou reatribuir pra
-- "Rosane Machado" por nome, mas ela ainda não existia como consultora —
-- essa migration corrige isso criando ela de verdade e reatribuindo).
--
-- Execute no SQL Editor do Supabase. Idempotente.

do $$
declare
  v_rosane_id uuid;
begin
  select id into v_rosane_id from consultoras where nome = 'Rosane Machado';

  if v_rosane_id is null then
    insert into consultoras (nome, email, produtos)
    values ('Rosane Machado', 'rosane@romabc.com.br', array['04a47734-abea-4d8f-899c-dc85543d7a9c']::uuid[])
    returning id into v_rosane_id;
  else
    update consultoras
    set produtos = array['04a47734-abea-4d8f-899c-dc85543d7a9c']::uuid[]
    where id = v_rosane_id;
  end if;

  update contratos
  set consultora_id = v_rosane_id
  where id = 'fd0227f3-771b-4020-8324-884d2e2eb414'
    and consultora_id is distinct from v_rosane_id;
end $$;

-- Confira depois de rodar:
--   select id, nome, email, produtos from consultoras where nome = 'Rosane Machado';
--   select id, consultora_id from contratos where id = 'fd0227f3-771b-4020-8324-884d2e2eb414';
-- consultora_id deve bater com o id da Rosane Machado acima.
