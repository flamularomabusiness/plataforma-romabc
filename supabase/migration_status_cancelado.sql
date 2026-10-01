-- ROMA BC — Fase 1 — Migration: Status CANCELADO em pagamentos_projetados
--
-- Confirmado direto no banco (pg_constraint): hoje
-- pagamentos_projetados_status_check só aceita PROJETADO/PAGO/ATRASADO/
-- INADIMPLENTE — CANCELADO existiu em versão anterior desta constraint
-- (ver comentário em migration_tipo_pagamento.sql) mas foi substituído por
-- INADIMPLENTE direto no Supabase Studio em algum momento, sem migration
-- correspondente. Esta migration ADICIONA CANCELADO de volta (não troca
-- nada, só estende a lista de valores aceitos).
--
-- CANCELADO representa uma parcela que não vai mais ser cobrada (ex.:
-- desconto negociado, erro de lançamento) mas cujo histórico deve ser
-- mantido — diferente de simplesmente zerar o valor, que perderia o
-- registro de que aquele valor um dia foi esperado.
--
-- Execute no SQL Editor do Supabase. Idempotente.

alter table pagamentos_projetados drop constraint if exists pagamentos_projetados_status_check;
alter table pagamentos_projetados add constraint pagamentos_projetados_status_check
  check (status = any (array['PROJETADO', 'PAGO', 'ATRASADO', 'INADIMPLENTE', 'CANCELADO']));

-- Confira depois de rodar:
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'pagamentos_projetados_status_check';
