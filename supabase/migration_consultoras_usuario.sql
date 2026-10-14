-- ROMA BC — Migration: vincular consultora a um usuário (conta de login)
--
-- O aviso "Novo cliente atribuído a você" passa a ir para o e-mail da CONTA
-- da consultora (public.usuarios.email — o que ela cadastrou ao criar a conta),
-- a mesma regra do Financeiro/Administrador. Para isso o banco precisa saber
-- qual usuário é qual consultora: são tabelas separadas e, até aqui, sem ligação.
--
--   * consultoras.usuario_id -> usuarios.id (opcional, um usuário por consultora
--     e uma consultora por usuário).
--   * Quem vincula: SÓ administrador, pela tela Gerenciar Usuários (RPC abaixo).
--     A própria pessoa NÃO escolhe no cadastro: senão qualquer um poderia se
--     passar por uma consultora e receber os dados dos clientes dela.
--   * Consultora sem usuário vinculado continua recebendo no consultoras.email
--     (se houver) — só não muda nada até alguém ser vinculado.
--
-- Depende de: consultoras.id uuid, usuarios, usuarios_e_administrator(uuid).
-- Idempotente. Execute no SQL Editor do Supabase.

do $$
declare
  v_tipo text;
begin
  select data_type into v_tipo from information_schema.columns
    where table_schema = 'public' and table_name = 'consultoras' and column_name = 'id';
  if v_tipo is distinct from 'uuid' then
    raise exception 'consultoras.id = % — esperado uuid (rode migration_fix_fk_contratos_consultora.sql antes).', v_tipo;
  end if;

  if not exists (select 1 from pg_proc where proname = 'usuarios_e_administrator') then
    raise exception 'Função usuarios_e_administrator(uuid) não existe — rode supabase/migration_auth_usuarios.sql antes.';
  end if;
end $$;

alter table consultoras
  add column if not exists usuario_id uuid references usuarios (id) on delete set null;

create unique index if not exists uq_consultoras_usuario_id
  on consultoras (usuario_id) where usuario_id is not null;

-- Vínculo automático SÓ onde não há dúvida: o e-mail da consultora é igual ao
-- e-mail de uma conta, e esse e-mail aparece uma única vez em consultoras.
update consultoras c
set usuario_id = u.id
from usuarios u
where c.usuario_id is null
  and c.email is not null
  and lower(btrim(c.email)) = lower(btrim(u.email))
  and (select count(*) from consultoras c2 where lower(btrim(c2.email)) = lower(btrim(u.email))) = 1
  and not exists (select 1 from consultoras c3 where c3.usuario_id = u.id);

-- Vincula (ou desvincula, com p_consultora_id = null) um usuário a uma consultora.
-- security definer porque o app não escreve em consultoras direto; a checagem de
-- administrador é feita aqui dentro, não na tela.
create or replace function vincular_consultora_usuario(p_usuario_id uuid, p_consultora_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not usuarios_e_administrator(auth.uid()) then
    raise exception 'Apenas administrador pode vincular consultora a usuário';
  end if;

  if not exists (select 1 from usuarios where id = p_usuario_id) then
    raise exception 'Usuário não encontrado';
  end if;

  -- Um usuário só pode ser UMA consultora: solta qualquer vínculo anterior.
  update consultoras set usuario_id = null where usuario_id = p_usuario_id;

  if p_consultora_id is not null then
    if exists (
      select 1 from consultoras
      where id = p_consultora_id and usuario_id is not null and usuario_id <> p_usuario_id
    ) then
      raise exception 'Esta consultora já está vinculada a outro usuário';
    end if;

    update consultoras set usuario_id = p_usuario_id where id = p_consultora_id;
    if not found then
      raise exception 'Consultora não encontrada';
    end if;
  end if;
end;
$$;

revoke execute on function vincular_consultora_usuario(uuid, uuid) from public, anon;
grant execute on function vincular_consultora_usuario(uuid, uuid) to authenticated, service_role;

-- Confira depois de rodar (quem ficou vinculado, quem ficou de fora):
--   select c.nome as consultora, c.email as email_consultora, u.email as email_da_conta
--   from consultoras c left join usuarios u on u.id = c.usuario_id order by c.nome;
--
--   select email, role, ativo from usuarios
--   where id not in (select usuario_id from consultoras where usuario_id is not null) order by email;
