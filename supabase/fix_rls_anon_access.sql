-- ROMA BC — Fase 1 — Fix: dropdowns/tabelas retornando vazio mesmo com dados no banco
--
-- DIAGNÓSTICO: a chamada REST feita com a anon key (a mesma usada pelo app)
-- retorna, para TODAS as tabelas, "Content-Range: */0" — ou seja, o Postgres
-- está confirmando que a role "anon" enxerga ZERO linhas, mesmo com os dados
-- existindo (visíveis no Supabase Studio porque o Studio usa uma sessão
-- privilegiada que ignora RLS). Isso é a assinatura clássica de Row Level
-- Security (RLS) habilitado sem nenhuma policy de SELECT para "anon".
--
-- Isso normalmente acontece quando as tabelas são criadas pela UI do
-- Supabase (Table Editor), que habilita RLS por padrão em tabelas novas —
-- diferente de rodar "create table" puro via SQL Editor, que deixa RLS
-- desabilitado. Não é um bug no código do app: lib/queries.ts já fazia
-- select("*") simples, sem filtros — a query em si está correta.
--
-- Execute este script no SQL Editor do Supabase. Idempotente (pode rodar
-- mais de uma vez sem erro).

alter table produtos disable row level security;
alter table consultoras disable row level security;
alter table clientes disable row level security;
alter table contatos_cliente disable row level security;
alter table contratos disable row level security;
alter table pagamentos_projetados disable row level security;

-- Confira o resultado: todas devem aparecer com rowsecurity = false.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'produtos', 'consultoras', 'clientes',
    'contatos_cliente', 'contratos', 'pagamentos_projetados'
  );
