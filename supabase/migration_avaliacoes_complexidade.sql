-- ROMA BC — Migration: Avaliações de Índice de Complexidade (ferramenta /ferramentas/indice-complexidade)
--
-- Guarda cada avaliação feita na ferramenta. Diferenças propositais em relação
-- ao rascunho do pedido:
--   * form_id NÃO é FK pra contratos: a ferramenta é aberta a partir do
--     formulário de Novo Contrato, e o contrato só passa a existir no submit.
--     form_id é só um token (uuid gerado pelo formulário) que casa a avaliação
--     com a aba do formulário que a pediu. O vínculo real é contrato_id, que o
--     formulário preenche DEPOIS que o contrato é criado.
--   * cliente_id também é opcional (set null): a empresa pode nem existir ainda
--     em `clientes` na hora da avaliação (cliente novo).
--   * RLS HABILITADO (mesmo padrão de contrato_documentos): qualquer usuário
--     ativo vê/cria/atualiza; só administrator apaga.
--
-- Depende de: usuario_ativo(uuid) (migration_contrato_documentos.sql) e
-- usuarios_e_administrator(uuid) (migration_auth_usuarios.sql /
-- migration_rename_administrator.sql). Rode essas antes se ainda não rodou.
--
-- Execute no SQL Editor do Supabase. Idempotente.

do $$
declare
  v_tipo_clientes text;
  v_tipo_contratos text;
begin
  select data_type into v_tipo_clientes
    from information_schema.columns
    where table_schema = 'public' and table_name = 'clientes' and column_name = 'id';
  select data_type into v_tipo_contratos
    from information_schema.columns
    where table_schema = 'public' and table_name = 'contratos' and column_name = 'id';

  if v_tipo_clientes is distinct from 'uuid' or v_tipo_contratos is distinct from 'uuid' then
    raise exception 'clientes.id = % e contratos.id = % — esperado uuid nos dois. Confira o schema real antes de rodar.',
      v_tipo_clientes, v_tipo_contratos;
  end if;

  if not exists (select 1 from pg_proc where proname = 'usuario_ativo') then
    raise exception 'Função usuario_ativo(uuid) não existe — rode supabase/migration_contrato_documentos.sql antes.';
  end if;

  if not exists (select 1 from pg_proc where proname = 'usuarios_e_administrator') then
    raise exception 'Função usuarios_e_administrator(uuid) não existe — rode supabase/migration_auth_usuarios.sql antes.';
  end if;
end $$;

create table if not exists avaliacoes_complexidade (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes (id) on delete set null,
  contrato_id uuid references contratos (id) on delete set null,
  form_id uuid,
  cliente_nome text not null,
  consultor text,
  data_avaliacao date not null default current_date,
  plano text check (plano in ('Start', 'Fortalecer', 'Performar')),
  score numeric(4, 2) not null check (score >= 1 and score <= 4),
  complexidade text not null check (complexidade in ('Baixa', 'Média', 'Alta', 'Muito Alta')),
  nivel_minimo_exigido text,
  consultores_sugeridos text[],
  multiplicador numeric(3, 2),
  dimensoes jsonb not null,
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_avaliacoes_complexidade_cliente_nome on avaliacoes_complexidade (cliente_nome);
create index if not exists idx_avaliacoes_complexidade_cliente_id on avaliacoes_complexidade (cliente_id);
create index if not exists idx_avaliacoes_complexidade_contrato_id on avaliacoes_complexidade (contrato_id);
create index if not exists idx_avaliacoes_complexidade_form_id on avaliacoes_complexidade (form_id);

alter table avaliacoes_complexidade enable row level security;

drop policy if exists avaliacoes_complexidade_select on avaliacoes_complexidade;
create policy avaliacoes_complexidade_select on avaliacoes_complexidade
  for select using (usuario_ativo(auth.uid()));

drop policy if exists avaliacoes_complexidade_insert on avaliacoes_complexidade;
create policy avaliacoes_complexidade_insert on avaliacoes_complexidade
  for insert with check (usuario_ativo(auth.uid()));

-- UPDATE existe só pro formulário preencher contrato_id/cliente_id depois que
-- o contrato é criado.
drop policy if exists avaliacoes_complexidade_update on avaliacoes_complexidade;
create policy avaliacoes_complexidade_update on avaliacoes_complexidade
  for update using (usuario_ativo(auth.uid())) with check (usuario_ativo(auth.uid()));

drop policy if exists avaliacoes_complexidade_delete on avaliacoes_complexidade;
create policy avaliacoes_complexidade_delete on avaliacoes_complexidade
  for delete using (usuarios_e_administrator(auth.uid()));

-- Confira depois de rodar:
--   select policyname, cmd from pg_policies where tablename = 'avaliacoes_complexidade';
--   select column_name, data_type from information_schema.columns where table_name = 'avaliacoes_complexidade' order by ordinal_position;
