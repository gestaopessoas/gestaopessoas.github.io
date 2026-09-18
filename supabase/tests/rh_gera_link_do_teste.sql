-- Issue #147: o RH logado emite a sessao do teste pela ficha do candidato, e quem nao esta
-- autenticado nao emite nada. Roda em transacao e termina em ROLLBACK: nao suja o banco.
--
-- Como rodar, com o supabase local de pe:
--   docker cp supabase/tests/rh_gera_link_do_teste.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql
--   docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
--
-- Passa quando sai LINK DO RH OK.
BEGIN;

DO $check$
DECLARE
  v_cand uuid;
  v_user uuid;
  v_a uuid;
  v_b uuid;
BEGIN
  SELECT id INTO v_cand FROM public.candidates LIMIT 1;
  SELECT id INTO v_user FROM public.profiles WHERE level >= 50 LIMIT 1;
  IF v_cand IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'SEM DADOS: precisa de ao menos um candidato e um perfil de nivel 50.';
  END IF;

  -- Sem sessao autenticada, `auth.uid()` e nulo: a porta fecha antes de olhar permissao.
  PERFORM set_config('request.jwt.claims', NULL, true);
  BEGIN
    PERFORM public.new_bfi_session_for_staff(v_cand);
    RAISE EXCEPTION 'FALHOU: anonimo conseguiu emitir sessao';
  EXCEPTION WHEN sqlstate 'P0001' THEN
    IF SQLERRM <> 'Acesso negado.' THEN RAISE; END IF;
  END;

  -- RH logado emite; clicar de novo devolve a mesma sessao em vez de abrir outra.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);
  v_a := public.new_bfi_session_for_staff(v_cand);
  v_b := public.new_bfi_session_for_staff(v_cand);
  IF v_a IS NULL OR v_a <> v_b THEN
    RAISE EXCEPTION 'FALHOU: sessao duplicada % <> %', v_a, v_b;
  END IF;

  RAISE NOTICE 'LINK DO RH OK';
END
$check$;

ROLLBACK;
