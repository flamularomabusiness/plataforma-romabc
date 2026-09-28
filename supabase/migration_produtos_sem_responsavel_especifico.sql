-- ROMA BC — Fase 1 — Migration: Produtos sem responsável específico
--
-- EXTRAS, HOLDING (Roma 20 e Roma 35, são produtos distintos com o mesmo
-- nome), PROJETOS ESPECIAIS C/ PRAZO DETERMINADO, VALUATION, CURSOS,
-- EXTRAS EDUCAÇÃO, IMPLANTAÇÃO + LICENÇA CA BPO e SOCIETÁRIO não têm
-- responsável específico por enquanto — decidido com o usuário que TODAS
-- as consultoras/responsáveis já cadastradas devem poder ser escolhidas
-- pra esses produtos (em vez de deixar o array vazio de cada uma, que já
-- teria esse efeito "aparece pra qualquer produto" só que de forma
-- implícita — aqui é explícito, adicionando esses ids no array de todo
-- mundo, sem tirar as atribuições específicas que já tinham).
--
-- Execute no SQL Editor do Supabase. Idempotente (soma sem duplicar, via
-- array_agg(distinct ...)).

do $$
declare
  v_extra_ids uuid[];
begin
  select array_agg(id) into v_extra_ids
  from produtos
  where nome in (
    'EXTRAS', 'HOLDING', 'PROJETOS ESPECIAIS C/ PRAZO DETERMINADO', 'VALUATION',
    'CURSOS', 'EXTRAS EDUCAÇÃO', 'IMPLANTAÇÃO + LICENÇA CA BPO', 'SOCIETÁRIO'
  );

  if coalesce(array_length(v_extra_ids, 1), 0) <> 9 then
    raise exception
      'Esperava encontrar 9 produtos (EXTRAS, HOLDING x2 — Roma 20 e Roma 35 —, PROJETOS ESPECIAIS C/ PRAZO DETERMINADO, VALUATION, CURSOS, EXTRAS EDUCAÇÃO, IMPLANTAÇÃO + LICENÇA CA BPO, SOCIETÁRIO), encontrou % — confira os nomes antes de rodar esta migration de novo.',
      coalesce(array_length(v_extra_ids, 1), 0);
  end if;

  update consultoras
  set produtos = (select array_agg(distinct x) from unnest(produtos || v_extra_ids) as x);
end $$;

-- Confira depois de rodar:
--   select nome, produtos from consultoras order by nome;
-- O array de cada uma deve ter crescido em 9 ids (sem perder os que já tinha).
