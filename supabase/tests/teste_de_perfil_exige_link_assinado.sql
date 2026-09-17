-- Issue #112: a sessao do teste de perfil so sai com ticket de candidatura valido, e so
-- aceita uma resposta. Roda em transacao e termina em ROLLBACK: nao suja o banco.
--
-- Como rodar, com o supabase local de pe:
--   docker cp supabase/tests/teste_de_perfil_exige_link_assinado.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql
--   docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
--
-- Passa quando sai LINK ASSINADO OK.
BEGIN;

DO $$
DECLARE
  v_ticket uuid := gen_random_uuid();
  v_outro  uuid := gen_random_uuid();
  v_sess   uuid;
  v_sess2  uuid;
  v_ok     boolean;
BEGIN
  -- O ticket e o proprio id do candidato no cadastro novo (migration 20260916210000).
  INSERT INTO public.public_application_tickets (id, ip_hash) VALUES (v_ticket, 'teste-112');
  INSERT INTO public.candidates (id, first_name, last_name, email)
  VALUES (v_ticket, 'Teste', 'Perfil', 'teste-112@example.com');

  v_sess := public.new_bfi_candidate_session(v_ticket, v_ticket);
  IF v_sess IS NULL THEN
    RAISE EXCEPTION 'Sessao nao foi emitida para ticket valido';
  END IF;

  -- Pedir de novo devolve a mesma sessao em aberto, nao uma pilha delas.
  v_sess2 := public.new_bfi_candidate_session(v_ticket, v_ticket);
  IF v_sess2 <> v_sess THEN
    RAISE EXCEPTION 'Emissao repetida criou sessao nova: % vs %', v_sess, v_sess2;
  END IF;

  -- Sem ticket que cubra o candidato, nao ha link.
  BEGIN
    PERFORM public.new_bfi_candidate_session(v_ticket, v_outro);
    RAISE EXCEPTION 'Ticket alheio emitiu sessao';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Ticket alheio emitiu sessao' THEN RAISE; END IF;
  END;

  -- Uso unico: a segunda resposta na mesma sessao e recusada.
  PERFORM public.submit_bfi_answers(v_sess, '{"1": 3, "2": 4}'::jsonb);
  BEGIN
    PERFORM public.submit_bfi_answers(v_sess, '{"1": 1, "2": 1}'::jsonb);
    RAISE EXCEPTION 'Sessao aceitou segunda resposta';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Sessao aceitou segunda resposta' THEN RAISE; END IF;
  END;

  -- A porta velha tem que ter sumido.
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'submit_bfi_candidate_answers'
  ) INTO v_ok;
  IF v_ok THEN
    RAISE EXCEPTION 'submit_bfi_candidate_answers continua no banco';
  END IF;

  RAISE NOTICE 'LINK ASSINADO OK';
END $$;

ROLLBACK;
