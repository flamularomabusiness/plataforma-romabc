-- ROMA BC — Fase 1 — Migration: Documentos do Contrato (Storage privado)
--
-- Diferente do resto do projeto — que roda com RLS desabilitado nas tabelas
-- de negócio (ver supabase/fix_rls_anon_access.sql) e confia só na camada de
-- app (lib/auth.ts + middleware.ts) — aqui é dado sigiloso de verdade
-- (documentos da empresa/pessoa do cliente), então RLS fica HABILITADO tanto
-- na tabela de metadados (contrato_documentos) quanto no bucket de Storage.
-- Decidido com o usuário: qualquer usuário ativo da plataforma (administrator,
-- financeiro, comercial — mesmo nível de acesso que já têm no resto da tela
-- do cliente) pode ver, enviar e apagar documentos; não há restrição por
-- role nem por dono do documento.
--
-- Execute no SQL Editor do Supabase. Idempotente.

create table if not exists contrato_documentos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contratos (id) on delete cascade,
  tipo text not null check (tipo in ('empresa', 'cliente')),
  nome_arquivo text not null,
  caminho_storage text not null,
  tamanho_bytes int,
  uploaded_by uuid not null references auth.users (id),
  data_criacao timestamptz not null default now()
);

create index if not exists idx_contrato_documentos_contrato on contrato_documentos (contrato_id);

alter table contrato_documentos enable row level security;

-- Mesmo padrão de usuarios_e_administrator() em migration_auth_usuarios.sql —
-- security definer pra não recursar RLS ao consultar a própria tabela
-- usuarios de dentro de uma policy.
create or replace function usuario_ativo(p_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from usuarios where id = p_id and ativo);
$$;

drop policy if exists contrato_documentos_select on contrato_documentos;
create policy contrato_documentos_select on contrato_documentos
  for select using (usuario_ativo(auth.uid()));

drop policy if exists contrato_documentos_insert on contrato_documentos;
create policy contrato_documentos_insert on contrato_documentos
  for insert with check (usuario_ativo(auth.uid()) and uploaded_by = auth.uid());

drop policy if exists contrato_documentos_delete on contrato_documentos;
create policy contrato_documentos_delete on contrato_documentos
  for delete using (usuario_ativo(auth.uid()));

-- Bucket privado (public=false — arquivo só é acessível via signed URL, não
-- por URL pública direta), com limite de 10MB e lista de tipos aceitos
-- reforçando o que já é validado no client antes do upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contrato-documentos',
  'contrato-documentos',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do nothing;

-- storage.objects já vem com RLS habilitado por padrão no Supabase — só
-- precisa das policies. name é o path completo do objeto (ex.:
-- "contratos/<contrato_id>/<uuid>-<arquivo>"), restringe pelo prefixo
-- "contratos/" além do bucket, defesa em profundidade caso o bucket
-- 'contrato-documentos' um dia passe a ser reaproveitado por outra feature.
drop policy if exists contrato_documentos_storage_select on storage.objects;
create policy contrato_documentos_storage_select on storage.objects
  for select using (
    bucket_id = 'contrato-documentos'
    and name like 'contratos/%'
    and usuario_ativo(auth.uid())
  );

drop policy if exists contrato_documentos_storage_insert on storage.objects;
create policy contrato_documentos_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'contrato-documentos'
    and name like 'contratos/%'
    and usuario_ativo(auth.uid())
  );

drop policy if exists contrato_documentos_storage_delete on storage.objects;
create policy contrato_documentos_storage_delete on storage.objects
  for delete using (
    bucket_id = 'contrato-documentos'
    and name like 'contratos/%'
    and usuario_ativo(auth.uid())
  );

-- Confira depois de rodar:
--   select * from storage.buckets where id = 'contrato-documentos';
--   select policyname from pg_policies where tablename = 'contrato_documentos';
--   select policyname from pg_policies where tablename = 'objects' and policyname like 'contrato_documentos%';
