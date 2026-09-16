-- A Publicacao do botao "Talento ACPO" tem que existir, ficar fora do portal e receber a
-- Candidatura do visitante. Roda em transacao e termina em ROLLBACK: nao suja o banco.
--
-- Como rodar, com o supabase local de pe:
--   docker cp supabase/tests/talento_acpo_publicacao_invisivel.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql
--   docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
--
-- Passa quando sai TALENTO ACPO OK.
BEGIN;

DO $$
DECLARE
  v_pool uuid;
  v_status text;
  v_obra uuid;
  v_publicas int;
BEGIN
  v_pool := public.talent_pool_opening();
  ASSERT v_pool IS NOT NULL, 'talent_pool_opening() devolveu NULL: o pool geral nao existe';

  SELECT status, workplace_id INTO v_status, v_obra
    FROM public.job_openings WHERE id = v_pool;
  ASSERT v_status = 'Espontanea', 'Publicacao do pool geral com status inesperado: ' || v_status;
  ASSERT v_obra IS NULL, 'Publicacao do pool geral nao deveria ter Obra';

  -- O portal lista get_public_careers(); a sintetica nao pode estar la.
  -- get_public_careers() devolve jsonb, nao tabela.
  SELECT count(*) INTO v_publicas
    FROM jsonb_array_elements(public.get_public_careers()) g
   WHERE g->>'id' = v_pool::text;
  ASSERT v_publicas = 0, 'A Publicacao do pool geral vazou para o portal publico';

  RAISE NOTICE 'TALENTO ACPO OK';
END $$;

ROLLBACK;
