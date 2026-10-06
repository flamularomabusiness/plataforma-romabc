-- ROMA BC — Migration: fechar EXECUTE das funções do schema public para o role anon
--
-- Contexto: o REVOKE do role anon nas TABELAS já foi feito (por segurança), mas
-- as funções continuavam com EXECUTE liberado pra anon (todas as migrations
-- tinham "grant execute ... to anon, authenticated"). Como a chave anon é
-- pública, qualquer pessoa podia chamar as RPCs direto na API do Supabase.
-- Hoje as funções security invoker (a maioria) já falham no acesso às tabelas,
-- mas isto fecha a porta de vez — inclusive pra qualquer função
-- security definer, que NÃO passaria pelo REVOKE das tabelas.
--
-- Por que "public" além de "anon": em Postgres toda função nasce com EXECUTE
-- pro pseudo-role PUBLIC, e o anon herda dele. Revogar só do anon não
-- adiantaria se o PUBLIC continuasse com o privilégio.
--
-- Quem continua executando: authenticated (o app, logado) e service_role (o
-- cron, via SUPABASE_SERVICE_ROLE_KEY). Nada no app chama RPC como anon
-- (cadastro/login usam a API de auth; o trigger handle_new_user não depende
-- de EXECUTE do anon).
--
-- Idempotente. Execute no SQL Editor do Supabase.

-- 1) Funções/procedures que já existem no schema public (menos as de extensões).
do $$
declare
  f record;
  total int := 0;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
      )
  loop
    execute format('revoke execute on function %s from public, anon', f.assinatura);
    -- Quem acessava SÓ via PUBLIC perderia o acesso junto: garante explícito.
    execute format('grant execute on function %s to authenticated, service_role', f.assinatura);
    total := total + 1;
  end loop;
  raise notice 'EXECUTE revogado de public/anon em % função(ões)', total;
end $$;

-- 2) Funções criadas DE AGORA EM DIANTE (pelo role que roda este script, o
-- postgres no SQL Editor) não nascem mais abertas pro anon.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public grant execute on functions to authenticated, service_role;

-- 3) Conferência — deve voltar ZERO linhas:
select p.oid::regprocedure as funcao_ainda_aberta_pro_anon
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind in ('f', 'p')
  and not exists (
    select 1 from pg_depend d
    where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
  )
  and has_function_privilege('anon', p.oid, 'EXECUTE');

-- E isto deve listar as RPCs do app com authenticated = true:
--   select p.proname,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
--          has_function_privilege('service_role',  p.oid, 'EXECUTE') as service_role,
--          has_function_privilege('anon',          p.oid, 'EXECUTE') as anon
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in ('criar_contrato_completo', 'importar_dados_excel',
--                       'atualizar_pagamentos_vencidos', 'estender_cronograma_recorrente',
--                       'deletar_cliente_soft', 'deletar_cliente_hard', 'restaurar_cliente',
--                       'usuario_ativo', 'usuarios_e_administrator');
--
-- ATENÇÃO ao rodar migrations antigas de novo: elas tinham
-- "grant execute ... to anon, authenticated" (já trocado por "to authenticated"
-- nos arquivos do repositório). Se você colar uma cópia antiga que ainda tenha
-- "to anon", rode este script de novo depois.
