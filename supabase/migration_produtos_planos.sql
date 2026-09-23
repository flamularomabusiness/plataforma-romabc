-- ROMA BC — Fase 1 — Migration: Produtos com Planos próprios + Filtro de
-- Responsáveis por Produto
--
-- Duas peças, decididas com o usuário ao planejar esta feature:
--
-- 1) produto_planos — tabela nova (planos hoje são uma constante estática
--    PLANOS = ["Padrão"] em lib/types.ts, sem ligação com produto nenhum).
--    contratos.plano_contratado continua text (sem FK) — só a LISTA de
--    opções do dropdown passa a vir daqui, filtrada pelo produto escolhido.
--    Garante os 4 produtos do pedido (2 já devem existir — Consultoria
--    Financeira e BPO Financeiro — e 2 são novos — Reforma Tributária e
--    Diagnóstico Tributário) e os planos de cada um, sem depender de UUIDs
--    fixos: procura por nome de UNE/produto, insere só o que faltar. Se uma
--    UNE não existir com o nome esperado, a migration para com um erro claro
--    em vez de inserir produto órfão ou duplicado.
--
-- 2) consultoras.produtos (uuid[]) — filtra quem aparece no dropdown de
--    Responsável quando um produto é escolhido no formulário. Array VAZIO
--    (default) = aparece para QUALQUER produto — fallback seguro que
--    preserva o comportamento atual pra quem ainda não foi explicitamente
--    associado a um produto. Semeada com os nomes que já vieram no pedido
--    original (Rosane Mello/Tainara Muller/Elisa → Consultoria Financeira;
--    Glaucia/Mayla → BPO Financeiro). Reforma/Diagnóstico Tributário ficam
--    sem ninguém atribuído por enquanto (produtos novos, sem responsável
--    conhecido) — todo mundo continua aparecendo pra eles até alguém rodar
--    um UPDATE (exemplo comentado no fim do arquivo).
--
-- Execute no SQL Editor do Supabase. Idempotente.

create table if not exists produto_planos (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos (id) on delete cascade,
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  data_criacao timestamptz not null default now()
);

create unique index if not exists idx_produto_planos_produto_nome
  on produto_planos (produto_id, nome);

alter table produto_planos disable row level security;

-- ---------------------------------------------------------------------------
-- Garante produto + planos, uma combinação (UNE, produto) por bloco.
-- ---------------------------------------------------------------------------

do $$
declare
  v_une_id uuid;
  v_produto_id uuid;
begin
  select id into v_une_id from unes where nome ilike 'Roma 20';
  if v_une_id is null then
    raise exception 'UNE "Roma 20" não encontrada — confira o nome real em unes.nome antes de rodar esta migration';
  end if;

  select id into v_produto_id from produtos where une_id = v_une_id and upper(nome) = 'CONSULTORIA FINANCEIRA';
  if v_produto_id is null then
    insert into produtos (une_id, nome, ativo) values (v_une_id, 'CONSULTORIA FINANCEIRA', true)
    returning id into v_produto_id;
  end if;

  insert into produto_planos (produto_id, nome)
  select v_produto_id, nome from (values ('START'), ('FORTALECER'), ('PERFORMAR')) as p(nome)
  on conflict (produto_id, nome) do nothing;
end $$;

-- Nome correto do produto de consultoria financeira na UNE YMPULS 46 é
-- "CONSULTORIA GREEN+", não "CONSULTORIA FINANCEIRA" (esse nome é só pra
-- Roma 20, bloco acima). Se uma execução anterior desta migration já criou
-- o produto com o nome errado (antes desta correção), RENOMEIA em vez de
-- criar um produto duplicado — preserva o id e os planos já vinculados.
do $$
declare
  v_une_id uuid;
  v_produto_id uuid;
begin
  select id into v_une_id from unes where nome ilike 'YMPULS 46';
  if v_une_id is null then
    raise exception 'UNE "YMPULS 46" não encontrada — confira o nome real em unes.nome antes de rodar esta migration';
  end if;

  select id into v_produto_id from produtos where une_id = v_une_id and upper(nome) = 'CONSULTORIA FINANCEIRA';
  if v_produto_id is not null then
    update produtos set nome = 'CONSULTORIA GREEN+' where id = v_produto_id;
  else
    select id into v_produto_id from produtos where une_id = v_une_id and upper(nome) = 'CONSULTORIA GREEN+';
    if v_produto_id is null then
      insert into produtos (une_id, nome, ativo) values (v_une_id, 'CONSULTORIA GREEN+', true)
      returning id into v_produto_id;
    end if;
  end if;

  insert into produto_planos (produto_id, nome)
  select v_produto_id, nome from (values ('START'), ('FORTALECER'), ('PERFORMAR')) as p(nome)
  on conflict (produto_id, nome) do nothing;
end $$;

do $$
declare
  v_une_id uuid;
  v_produto_id uuid;
begin
  select id into v_une_id from unes where nome ilike 'Roma 35';
  if v_une_id is null then
    raise exception 'UNE "Roma 35" não encontrada — confira o nome real em unes.nome antes de rodar esta migration';
  end if;

  select id into v_produto_id from produtos where une_id = v_une_id and upper(nome) = 'BPO FINANCEIRO';
  if v_produto_id is null then
    insert into produtos (une_id, nome, ativo) values (v_une_id, 'BPO FINANCEIRO', true)
    returning id into v_produto_id;
  end if;

  insert into produto_planos (produto_id, nome)
  select v_produto_id, nome from (values ('LIGHT'), ('BASIC'), ('PRO')) as p(nome)
  on conflict (produto_id, nome) do nothing;
end $$;

do $$
declare
  v_une_id uuid;
  v_produto_id uuid;
begin
  select id into v_une_id from unes where nome ilike 'Roma 20';
  if v_une_id is null then
    raise exception 'UNE "Roma 20" não encontrada — confira o nome real em unes.nome antes de rodar esta migration';
  end if;

  select id into v_produto_id from produtos where une_id = v_une_id and upper(nome) = 'CONSULTORIA REFORMA TRIBUTÁRIA';
  if v_produto_id is null then
    insert into produtos (une_id, nome, ativo) values (v_une_id, 'CONSULTORIA REFORMA TRIBUTÁRIA', true)
    returning id into v_produto_id;
  end if;

  insert into produto_planos (produto_id, nome)
  select v_produto_id, nome from (values ('VISÃO'), ('CLAREZA'), ('DOMÍNIO'), ('SOB MEDIDA')) as p(nome)
  on conflict (produto_id, nome) do nothing;
end $$;

do $$
declare
  v_une_id uuid;
  v_produto_id uuid;
begin
  select id into v_une_id from unes where nome ilike 'Roma 20';
  if v_une_id is null then
    raise exception 'UNE "Roma 20" não encontrada — confira o nome real em unes.nome antes de rodar esta migration';
  end if;

  select id into v_produto_id from produtos where une_id = v_une_id and upper(nome) = 'DIAGNÓSTICO TRIBUTÁRIO';
  if v_produto_id is null then
    insert into produtos (une_id, nome, ativo) values (v_une_id, 'DIAGNÓSTICO TRIBUTÁRIO', true)
    returning id into v_produto_id;
  end if;

  insert into produto_planos (produto_id, nome)
  select v_produto_id, nome from (values ('VISÃO'), ('CLAREZA'), ('DOMÍNIO'), ('SOB MEDIDA')) as p(nome)
  on conflict (produto_id, nome) do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- Filtro de Responsáveis por Produto.
-- ---------------------------------------------------------------------------

alter table consultoras add column if not exists produtos uuid[] not null default '{}';

-- Quem atende CONSULTORIA FINANCEIRA (Roma 20) também atende CONSULTORIA
-- GREEN+ (Ympuls 46) — mesmo produto de consultoria financeira, só com nome
-- diferente por UNE.
update consultoras
set produtos = (
  select coalesce(array_agg(id), '{}') from produtos
  where upper(nome) in ('CONSULTORIA FINANCEIRA', 'CONSULTORIA GREEN+')
)
where nome in ('Rosane Mello', 'Tainara Muller', 'Elisa');

update consultoras
set produtos = (select coalesce(array_agg(id), '{}') from produtos where upper(nome) = 'BPO FINANCEIRO')
where nome in ('Glaucia', 'Mayla');

-- Pra atribuir alguém a um produto novo mais tarde (ex. Reforma Tributária),
-- rode algo como:
--   update consultoras
--   set produtos = produtos || (select id from produtos where upper(nome) = 'CONSULTORIA REFORMA TRIBUTÁRIA')
--   where nome = 'Fulano';

-- Confira depois de rodar:
--   select p.nome as produto, u.nome as une, array_agg(pl.nome order by pl.nome) as planos
--   from produtos p join unes u on u.id = p.une_id
--   left join produto_planos pl on pl.produto_id = p.id
--   group by p.nome, u.nome order by u.nome, p.nome;
--   select nome, produtos from consultoras where produtos <> '{}' order by nome;
