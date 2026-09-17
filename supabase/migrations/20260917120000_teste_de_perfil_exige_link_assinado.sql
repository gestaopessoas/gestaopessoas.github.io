-- Issue #112: /candidato/teste-personalidade abria so com `?candidate_id=<uuid>`. Sem token,
-- sem validade, sem uso unico: quem tivesse o uuid — que fica no historico do navegador, em
-- link compartilhado, em print — respondia o Big Five em nome do candidato, de novo e de novo,
-- e o resultado entrava na ficha como se fosse dele.
--
-- O mecanismo de sessao ja existe e ja e usado pelo colaborador: a linha de
-- `candidate_big_five_results` E a sessao, e `submit_bfi_answers` valida expiracao e uso
-- unico. O que faltava era emitir essa sessao para o candidato publico sem deixar qualquer
-- um emitir uma. Quem autoriza e o ticket da candidatura (migrations 20260916210000 e
-- 20260916220000), o mesmo que ja autoriza o insert em `job_applications`.

CREATE OR REPLACE FUNCTION public.new_bfi_candidate_session(p_candidate uuid, p_ticket uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Duas portas, as mesmas da policy de `job_applications`: o ticket e o proprio candidato
  -- (cadastro novo) ou o ticket reivindicou um candidato antigo (reaproveitamento).
  IF p_ticket IS NULL
     OR (p_ticket <> p_candidate AND NOT public.ticket_claims_candidate(p_candidate))
  THEN
    RAISE EXCEPTION 'Ticket invalido para este candidato.';
  END IF;

  IF p_ticket = p_candidate AND NOT public.is_valid_application_ticket(p_candidate::text) THEN
    RAISE EXCEPTION 'Ticket invalido para este candidato.';
  END IF;

  -- Uma sessao por pessoa por vez: pedir link de novo nao multiplica teste em aberto.
  SELECT r.id INTO v_id
    FROM public.candidate_big_five_results r
   WHERE r.candidate_id = p_candidate
     AND r.expires_at > now()
     AND NOT EXISTS (SELECT 1 FROM public.candidate_big_five_answers a WHERE a.result_id = r.id)
   ORDER BY r.expires_at DESC
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.candidate_big_five_results (candidate_id, expires_at)
  VALUES (p_candidate, now() + interval '7 days')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.new_bfi_candidate_session(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.new_bfi_candidate_session(uuid, uuid) TO anon, authenticated;

-- A porta velha fecha. `submit_bfi_candidate_answers` gravava um resultado novo a partir de
-- um `candidate_id` cru, que e exatamente o buraco desta issue. Quem responde agora passa por
-- `submit_bfi_answers`, que exige a sessao e recusa a segunda resposta.
DROP FUNCTION IF EXISTS public.submit_bfi_candidate_answers(uuid, jsonb);
