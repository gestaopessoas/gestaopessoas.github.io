-- ROLLBACK: ALTER TABLE public.companies DROP COLUMN status;
--           (so faca isso se tiver certeza de que ninguem depende dela)
--
-- Deriva de schema: `public.companies.status` existe em PRODUCAO mas nao em nenhuma
-- migration. Apareceu quando o dump de producao foi restaurado num banco construido
-- pelas migrations: o `COPY` de `companies` falhou por coluna a mais, a tabela ficou
-- vazia, e a partir dai NENHUMA ficha salvava no ambiente local — o select "Empresa"
-- abria sem opcao e a chave estrangeira derrubava a reativacao.
--
-- Em producao isto e um no-op (a coluna ja existe, `IF NOT EXISTS`). O que a migration
-- conserta e a capacidade de reconstruir o banco do zero e obter o mesmo schema que
-- esta no ar — que e a unica forma de o ensaio no Docker valer alguma coisa.
--
-- Valor e default copiados do schema de producao (backups/schema-20260908-1441.sql).

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS status text DEFAULT 'Ativo'::text;
