-- ROMA BC — Migration: log de notificações por e-mail (novo contrato)
--
-- Uma linha por e-mail disparado pelo formulário de Novo Contrato
-- (lib/notificacoes.ts): ENVIADO, ERRO ou IGNORADO (sem destinatário).
--
-- Permissões (depois do REVOKE do anon):
--   * ESCRITA: só o servidor, com a service-role key (ela ignora RLS e GRANT).
--     Nenhum usuário logado consegue inserir/alterar/apagar pelo browser.
--   * LEITURA: RLS habilitado; só usuário ATIVO com role financeiro ou
--     administrator (é o que a tela do cliente mostra). O log tem e-mails da
--     equipe, por isso não segui o padrão "RLS desligado" das tabelas antigas.
--   * anon: sem acesso nenhum.
--
-- Depende de: tabelas clientes, contratos e usuarios. Idempotente.
-- Execute no SQL Editor do Supabase.

do $$
declare
  v_clientes text;
  v_contratos text;
begin
  select data_type into v_clientes from information_schema.columns
    where table_schema = 'public' and table_name = 'clientes' and column_name = 'id';
  select data_type into v_contratos from information_schema.columns
    where table_schema = 'public' and table_name = 'contratos' and column_name = 'id';
  if v_clientes is distinct from 'uuid' or v_contratos is distinct from 'uuid' then
    raise exception 'clientes.id = % e contratos.id = % — esperado uuid nos dois. Confira o schema real antes de rodar.',
      v_clientes, v_contratos;
  end if;
end $$;

create table if not exists notificacoes_email (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid references contratos (id) on delete set null,
  cliente_id uuid references clientes (id) on delete set null,
  tipo text not null check (tipo in ('NOVO_CONTRATO_FINANCEIRO', 'NOVO_CONTRATO_RESPONSAVEL')),
  destinatarios text[] not null default '{}',
  assunto text not null,
  status text not null check (status in ('ENVIADO', 'ERRO', 'IGNORADO')),
  erro text,
  created_at timestamptz not null default now()
);

create index if not exists idx_notificacoes_email_contrato on notificacoes_email (contrato_id);
create index if not exists idx_notificacoes_email_cliente on notificacoes_email (cliente_id);
create index if not exists idx_notificacoes_email_created on notificacoes_email (created_at desc);

-- security definer: consulta `usuarios` sem recursar a RLS dela (mesmo padrão
-- de usuarios_e_administrator / usuario_ativo).
create or replace function usuario_financeiro_ou_admin(p_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from usuarios
    where id = p_id and ativo and role in ('financeiro', 'administrator')
  );
$$;

revoke execute on function usuario_financeiro_ou_admin(uuid) from public, anon;
grant execute on function usuario_financeiro_ou_admin(uuid) to authenticated, service_role;

alter table notificacoes_email enable row level security;

drop policy if exists notificacoes_email_select on notificacoes_email;
create policy notificacoes_email_select on notificacoes_email
  for select using (usuario_financeiro_ou_admin(auth.uid()));

-- Sem policy de insert/update/delete de propósito: só a service role escreve.
revoke all on notificacoes_email from public, anon, authenticated;
grant select on notificacoes_email to authenticated;
grant all on notificacoes_email to service_role;

-- Confira depois de rodar:
--   select policyname, cmd from pg_policies where tablename = 'notificacoes_email';
--   select grantee, privilege_type from information_schema.role_table_grants
--     where table_name = 'notificacoes_email' order by grantee, privilege_type;
--
-- Consultoras SEM e-mail (o e-mail do responsável não chega pra elas — o log
-- marca IGNORADO). A coluna consultoras.email já existe, não precisa de migration:
--   select id, nome from consultoras where email is null or btrim(email) = '' order by nome;
-- Preencher:
--   update consultoras set email = 'fulana@romabc.com.br' where nome = 'Fulana';
--
-- Usuários que receberão o e-mail do Financeiro:
--   select email, role from usuarios where ativo and role in ('financeiro', 'administrator') order by email;
