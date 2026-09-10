-- ROMA BC — Fase 1 — Migration: renomear GERENTE -> ADMINISTRATOR + desativar
-- usuário (em vez de deletar) + FINANCEIRO ganha acesso igual a ADMINISTRATOR
-- (exceto gerenciar usuários).
--
-- Rode isto SE você já rodou supabase/migration_auth_usuarios.sql antes (ou
-- seja, se a tabela usuarios já existe). Se está montando o banco do zero,
-- não precisa deste arquivo — migration_auth_usuarios.sql já nasce com
-- 'administrator'.
--
-- ORDEM IMPORTA: atualiza os dados (role='gerente' -> 'administrator')
-- ANTES de trocar o check constraint e as policies pra exigir
-- 'administrator' — na ordem contrária, o administrator existente ficaria
-- de fora da própria checagem (linha ainda 'gerente', policy já exigindo
-- 'administrator') pelo tempo entre os dois comandos.
--
-- "Deletar usuário" virou "desativar" (coluna usuarios.ativo): apagar de
-- verdade a conta exigiria a Admin API do Supabase (service_role key, que
-- este app não guarda em lugar nenhum — nunca deveria ficar acessível pelo
-- cliente, já que ela ignora toda RLS do banco). Desativar tem o mesmo
-- efeito prático (perde acesso ao app na hora) sem precisar dessa chave, e
-- sem apagar o histórico da conta.
--
-- BUG CRÍTICO CORRIGIDO AQUI (achado testando esta mesma tarefa): as
-- policies de usuarios em migration_auth_usuarios.sql faziam
-- "exists (select 1 from usuarios g where g.id = auth.uid() and g.role =
-- 'gerente')" DIRETO dentro da própria policy da tabela usuarios. Isso causa
-- RECURSÃO INFINITA de verdade no Postgres (a policy reavalia a si mesma pra
-- resolver a subquery, sem convergir sozinha) — toda leitura de usuarios
-- vinha falhando com "infinite recursion detected in policy for relation
-- usuarios" desde a migration anterior. Na prática, isso significa que
-- NENHUMA role real era lida (buscarLinhaUsuario engolia o erro e caía no
-- fallback "comercial") — todo mundo rodava como comercial, mesmo quem já
-- tinha sido promovido a gerente pelo SQL Editor. Corrigido movendo a
-- checagem pra uma função security definer (roda com privilégio do dono da
-- função, ignorando RLS na própria consulta interna — quebra o ciclo).
--
-- Execute no SQL Editor do Supabase. Idempotente.

create or replace function usuarios_e_administrator(p_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from usuarios where id = p_id and role = 'administrator');
$$;

-- 1) Dado primeiro.
update usuarios set role = 'administrator' where role = 'gerente';

-- 2) Coluna nova.
alter table usuarios add column if not exists ativo boolean not null default true;

-- 3) Constraint novo (o nome usuarios_role_check é o padrão que o Postgres dá
-- pra um check sem nome explícito numa coluna "role" — é o que a criação
-- original em migration_auth_usuarios.sql gerou).
alter table usuarios drop constraint if exists usuarios_role_check;
alter table usuarios add constraint usuarios_role_check
  check (role in ('administrator', 'financeiro', 'comercial'));

-- 4) Policies — mesma lógica de antes, só trocando 'gerente' por
-- 'administrator' na checagem de quem vê/edita todo mundo.
drop policy if exists usuarios_select on usuarios;
create policy usuarios_select on usuarios
  for select using (
    auth.uid() = id
    or usuarios_e_administrator(auth.uid())
  );

drop policy if exists usuarios_update on usuarios;
create policy usuarios_update on usuarios
  for update using (
    auth.uid() = id
    or usuarios_e_administrator(auth.uid())
  );

-- 5) Trigger de defesa em profundidade — troca de role continua exigindo
-- quem pede já ser administrator; adiciona a mesma proteção pra ativo (não
-- dá pra se auto-desativar, nem sendo administrator — senão o último
-- administrator ativo poderia se trancar fora sozinho, sem ninguém pra
-- reativar). auth.uid() nulo (acesso direto pelo SQL Editor) sempre passa —
-- é como o bootstrap do primeiro administrator funciona.
create or replace function usuarios_bloquear_auto_promocao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quem_pede_role text;
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    select role into v_quem_pede_role from usuarios where id = auth.uid();
    if coalesce(v_quem_pede_role, '') != 'administrator' then
      raise exception 'Só um usuário com role administrator pode alterar a role de alguém';
    end if;
  end if;

  if new.ativo is distinct from old.ativo and auth.uid() is not null and new.id = auth.uid() then
    raise exception 'Você não pode ativar/desativar a própria conta';
  end if;

  new.data_atualizacao := now();
  return new;
end;
$$;

-- Confira depois de rodar:
--   select email, role, ativo from usuarios;
-- Quem antes era 'gerente' deve aparecer como 'administrator', e todo mundo
-- deve estar com ativo = true.
