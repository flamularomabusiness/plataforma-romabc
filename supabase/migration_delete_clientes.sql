-- ROMA BC — Fase 1 — Migration: Deletar Cliente (soft delete + hard delete)
--
-- Quem pode: só administrator e financeiro (NÃO comercial — diferente da
-- spec original, que pedia o botão pros 3. Comercial hoje nem edita status
-- de cliente; dar poder de ocultar QUALQUER cliente do sistema — não existe
-- conceito de "dono" do cliente — seria uma permissão nova mais sensível do
-- que tudo que comercial já tem. Decisão confirmada com o usuário.)
--   • administrator: soft delete OU hard delete (com checagem de elegibilidade).
--   • financeiro: só soft delete.
--   • administrator: único que restaura um soft-deletado.
--
-- HARD DELETE NÃO É INCONDICIONAL — decisão confirmada com o usuário: apagar
-- de verdade contratos/pagamentos de um cliente com histórico financeiro
-- real (qualquer pagamento PAGO/ATRASADO/INADIMPLENTE) destruiria dado que
-- uma empresa brasileira normalmente precisa manter por anos (fiscal), sem
-- chance de recuperar. Pior: um contrato pode pertencer a MAIS de um
-- cliente (contrato_empresas, feature já existente) — apagar sem checar
-- isso apagaria por engano o contrato de outro cliente que o compartilha.
-- Por isso deletar_cliente_hard recusa (raise exception, orientando a usar
-- soft delete) se:
--   1) algum contrato deste cliente tem pagamento PAGO/ATRASADO/INADIMPLENTE, ou
--   2) algum contrato deste cliente também pertence a outro cliente.
-- Só apaga de verdade quando o cliente é "limpo" (sem histórico financeiro
-- de fato ocorrido, sem contrato compartilhado).
--
-- SEGURANÇA: clientes/contratos/pagamentos_projetados/contrato_empresas não
-- têm RLS habilitada neste projeto (decisão de uma fase anterior, quando
-- ainda não existia autenticação real) — então nada no banco IMPEDE alguém
-- de chamar supabase.from('clientes').delete() direto, ignorando esta RPC.
-- O que esta migration garante é que o FLUXO NORMAL DO APP (que só chama
-- estas funções, nunca .delete()/.update() direto em clientes/contratos pra
-- isso) sempre passa pela checagem de role e pela auditoria abaixo. Fechar
-- esse buraco de vez exigiria habilitar RLS nessas tabelas — mudança maior,
-- fora do escopo desta tarefa (documentado, não resolvido aqui).
--
-- Execute no SQL Editor do Supabase. Idempotente.

alter table clientes add column if not exists deletado boolean not null default false;
alter table clientes add column if not exists deletado_em timestamptz;
alter table clientes add column if not exists deletado_por uuid references auth.users(id);

create index if not exists idx_clientes_deletado on clientes (deletado);

create table if not exists log_deletacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  registro_id uuid not null,
  registro_nome text,
  deletado_por uuid not null references auth.users(id),
  tipo_delete text not null check (tipo_delete in ('hard', 'soft')),
  motivo text,
  data_criacao timestamptz not null default now()
);

create index if not exists idx_log_deletacoes_data on log_deletacoes (data_criacao desc);

alter table log_deletacoes disable row level security;

create or replace function deletar_cliente_soft(p_cliente_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_nome text;
begin
  select role into v_role from usuarios where id = auth.uid();
  if coalesce(v_role, '') not in ('administrator', 'financeiro') then
    raise exception 'Sem permissão para deletar clientes';
  end if;

  select nome_razao_social into v_nome from clientes where id = p_cliente_id;
  if v_nome is null then
    raise exception 'Cliente não encontrado';
  end if;

  update clientes set
    deletado = true,
    deletado_em = now(),
    deletado_por = auth.uid()
  where id = p_cliente_id;

  insert into log_deletacoes (tipo, registro_id, registro_nome, deletado_por, tipo_delete, motivo)
  values ('cliente', p_cliente_id, v_nome, auth.uid(), 'soft', p_motivo);
end;
$$;

create or replace function restaurar_cliente(p_cliente_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select role into v_role from usuarios where id = auth.uid();
  if coalesce(v_role, '') != 'administrator' then
    raise exception 'Só um administrator pode restaurar clientes';
  end if;

  update clientes set
    deletado = false,
    deletado_em = null,
    deletado_por = null
  where id = p_cliente_id;
end;
$$;

create or replace function deletar_cliente_hard(p_cliente_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_nome text;
  v_contratos uuid[];
  v_tem_pagamento_real boolean;
  v_contrato_compartilhado boolean;
begin
  select role into v_role from usuarios where id = auth.uid();
  if coalesce(v_role, '') != 'administrator' then
    raise exception 'Só um administrator pode apagar um cliente permanentemente';
  end if;

  select nome_razao_social into v_nome from clientes where id = p_cliente_id;
  if v_nome is null then
    raise exception 'Cliente não encontrado';
  end if;

  -- Contratos deste cliente por QUALQUER um dos 2 caminhos: a coluna legada
  -- contratos.cliente_id (mantida por compatibilidade, sempre a "primeira"
  -- empresa) e a tabela real de ligação contrato_empresas (many-to-many).
  select array_agg(distinct c.id) into v_contratos
  from contratos c
  where c.cliente_id = p_cliente_id
     or c.id in (select contrato_id from contrato_empresas where cliente_id = p_cliente_id);

  if v_contratos is not null then
    select exists (
      select 1 from pagamentos_projetados
      where contrato_id = any(v_contratos)
        and status in ('PAGO', 'ATRASADO', 'INADIMPLENTE')
    ) into v_tem_pagamento_real;

    if v_tem_pagamento_real then
      raise exception 'Este cliente tem pagamentos já pagos/atrasados registrados — apagar de verdade destruiria histórico financeiro. Use "ocultar" (soft delete) em vez disso.';
    end if;

    select exists (
      select 1 from contrato_empresas
      where contrato_id = any(v_contratos)
        and cliente_id != p_cliente_id
    ) into v_contrato_compartilhado;

    if v_contrato_compartilhado then
      raise exception 'Um ou mais contratos deste cliente são compartilhados com outra empresa — apagar de verdade destruiria o contrato dela também. Use "ocultar" (soft delete) em vez disso.';
    end if;
  end if;

  insert into log_deletacoes (tipo, registro_id, registro_nome, deletado_por, tipo_delete, motivo)
  values ('cliente', p_cliente_id, v_nome, auth.uid(), 'hard', p_motivo);

  -- Apaga os contratos deste cliente — cascata já cuida de
  -- pagamentos_projetados, contrato_empresas e pessoas_cliente (todas com
  -- "on delete cascade" em contrato_id).
  if v_contratos is not null then
    delete from contratos where id = any(v_contratos);
  end if;

  delete from contatos_cliente where cliente_id = p_cliente_id;
  delete from clientes where id = p_cliente_id;
end;
$$;

grant execute on function deletar_cliente_soft(uuid, text) to anon, authenticated;
grant execute on function restaurar_cliente(uuid) to anon, authenticated;
grant execute on function deletar_cliente_hard(uuid, text) to anon, authenticated;

-- Confira depois de rodar:
--   select column_name from information_schema.columns where table_name = 'clientes' and column_name like 'deletado%';
--   select * from log_deletacoes order by data_criacao desc limit 5;
