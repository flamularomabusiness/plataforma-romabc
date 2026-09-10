-- ROMA BC — Fase 1 — Migration: Login com Email/Senha (Supabase Auth)
--
-- Substitui o "mock" de role em localStorage por autenticação real. Cria a
-- tabela usuarios (1:1 com auth.users, guardando a role de cada um) e um
-- trigger que preenche essa linha automaticamente quando alguém se cadastra.
--
-- DECISÃO DE SEGURANÇA IMPORTANTE — role nunca vem do cliente:
-- a spec original deste login pedia um <select> de role (ADMINISTRATOR/FINANCEIRO/
-- COMERCIAL) na tela de cadastro. Isso é uma escalação de privilégio óbvia:
-- qualquer pessoa que se cadastrasse escolheria "ADMINISTRATOR" e teria acesso
-- total (clientes, contratos, valores). Por isso:
--   1) o cadastro (app/signup) só manda email/senha pro Supabase Auth —
--      não existe campo de role em lugar nenhum do cadastro;
--   2) o trigger abaixo (handle_new_user) é o ÚNICO lugar que cria a linha
--      em usuarios, e SEMPRE com role = 'COMERCIAL' (a de menor privilégio)
--      — o cliente não tem como mandar outra role nesse momento, o trigger
--      roda no banco, fora do alcance do request;
--   3) promover alguém pra ADMINISTRATOR/FINANCEIRO exige uma role já ADMINISTRATOR
--      alterando a linha de outro usuário (RLS abaixo permite isso) — não
--      existe autopromoção: a policy de UPDATE só deixa um usuário mudar a
--      PRÓPRIA role se ele MESMO já for ADMINISTRATOR (nunca passa de comercial/
--      financeiro pra administrator sozinho), e um trigger adicional
--      (bloquear_troca_de_role) barra qualquer tentativa de contornar isso
--      via update direto (defesa em profundidade, não depende só da RLS).
--
-- Execute no SQL Editor do Supabase. Idempotente.

-- NOTA: se este banco já tinha a versão anterior desta tabela (com role
-- 'gerente' em vez de 'administrator'), NÃO baste rodar este arquivo de
-- novo — as policies abaixo usam "create policy" sem "if not exists", então
-- re-executá-las já troca a checagem pra 'administrator' na hora, só que os
-- dados continuariam com role='gerente', travando quem já era admin fora do
-- próprio sistema. Nesse caso rode supabase/migration_rename_administrator.sql
-- em vez deste (ele migra o dado e o schema juntos, na ordem certa). Este
-- arquivo aqui é só pra quem está montando o banco do zero.
create table if not exists usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role text not null default 'comercial' check (role in ('administrator', 'financeiro', 'comercial')),
  ativo boolean not null default true,
  nome text,
  data_criacao timestamptz not null default now(),
  data_atualizacao timestamptz not null default now()
);

alter table usuarios enable row level security;

-- Checagem "sou administrator?" isolada numa função security definer em vez
-- de um "exists (select 1 from usuarios ...)" direto dentro da policy da
-- PRÓPRIA tabela usuarios: colocado assim inline, causa recursão infinita de
-- verdade no Postgres (a policy reavalia a si mesma pra resolver a
-- subquery). security definer roda com privilégio do dono da função,
-- ignorando RLS na consulta interna — quebra o ciclo.
create or replace function usuarios_e_administrator(p_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from usuarios where id = p_id and role = 'administrator');
$$;

-- SELECT: cada um vê a própria linha; ADMINISTRATOR vê todo mundo (precisa pra
-- listar usuários numa tela de gestão, e pra saber a role de outra pessoa
-- ao decidir quem promover).
drop policy if exists usuarios_select on usuarios;
create policy usuarios_select on usuarios
  for select using (
    auth.uid() = id
    or usuarios_e_administrator(auth.uid())
  );

-- UPDATE: cada um pode mexer na própria linha (ex.: nome) OU um ADMINISTRATOR pode
-- mexer em qualquer linha (pra promover/rebaixar alguém). A troca de role em
-- si é barrada pelo trigger abaixo pra quem não é ADMINISTRATOR, mesmo que esta
-- policy sozinha permitisse o update de outros campos da própria linha.
drop policy if exists usuarios_update on usuarios;
create policy usuarios_update on usuarios
  for update using (
    auth.uid() = id
    or usuarios_e_administrator(auth.uid())
  );

-- Nenhuma policy de INSERT/DELETE pro cliente: a única linha inserida vem do
-- trigger (roda como security definer da função, não como o usuário), e não
-- há fluxo de exclusão de usuário no app.

-- Defesa em profundidade: mesmo que a policy de UPDATE acima permita a um
-- usuário comum atualizar a PRÓPRIA linha (pra campos como nome), barra
-- explicitamente qualquer tentativa de MUDAR a própria role a menos que
-- quem está fazendo o update já seja ADMINISTRATOR — sem isso, "cada um pode
-- editar a própria linha" também deixaria trocar a própria role sozinho.
create or replace function usuarios_bloquear_auto_promocao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quem_pede_role text;
begin
  -- auth.uid() só existe dentro de um request autenticado do app (via
  -- PostgREST/RLS) — um update rodado direto no SQL Editor do Supabase (ex.:
  -- promover a primeira pessoa a administrator, já que ninguém começa como
  -- administrator) tem auth.uid() nulo. Sem este "if", NINGUÉM conseguiria virar
  -- administrator pela primeira vez: a checagem abaixo sempre bloquearia por não
  -- achar nenhum usuário administrator ainda. Acesso direto ao SQL Editor já exige
  -- as credenciais do projeto Supabase — é um contexto confiável por si só.
  if new.role is distinct from old.role and auth.uid() is not null then
    select role into v_quem_pede_role from usuarios where id = auth.uid();
    if coalesce(v_quem_pede_role, '') != 'administrator' then
      raise exception 'Só um usuário com role administrator pode alterar a role de alguém';
    end if;
  end if;

  -- Ninguém desativa a própria conta (nem um administrator) — sem isso, o
  -- último administrator ativo poderia se travar fora do sistema sozinho,
  -- sem ninguém pra reativar. auth.uid() is null de novo cobre o acesso
  -- direto pelo SQL Editor (não é bloqueado).
  if new.ativo is distinct from old.ativo and auth.uid() is not null and new.id = auth.uid() then
    raise exception 'Você não pode ativar/desativar a própria conta';
  end if;

  new.data_atualizacao := now();
  return new;
end;
$$;

drop trigger if exists trg_usuarios_bloquear_auto_promocao on usuarios;
create trigger trg_usuarios_bloquear_auto_promocao
  before update on usuarios
  for each row
  execute function usuarios_bloquear_auto_promocao();

-- Cria a linha em usuarios automaticamente a cada signup — sempre role
-- 'comercial' (ver decisão de segurança no topo do arquivo). security
-- definer: precisa rodar com privilégio pra inserir em usuarios mesmo antes
-- de existir qualquer policy que autorizaria o próprio usuário recém-criado
-- a se auto-inserir (não existe policy de insert pro cliente, de propósito).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into usuarios (id, email, role)
  values (new.id, new.email, 'comercial')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row
  execute function handle_new_user();

-- Confira depois de rodar: cria uma conta pelo /signup e rode
-- select * from usuarios; — deve aparecer com role = 'comercial'.
--
-- BOOTSTRAP: ninguém nasce administrator. Depois de criar sua própria conta pelo
-- /signup (ela também vem como comercial), promova ela pra administrator rodando
-- isto aqui no SQL Editor (troque o e-mail):
--   update usuarios set role = 'administrator' where email = 'seu-email@romabc.com.br';
-- Dali em diante, promover qualquer outra pessoa pode ser feito pelo próprio
-- app por quem já é administrator (não precisa mais voltar aqui no SQL Editor).
