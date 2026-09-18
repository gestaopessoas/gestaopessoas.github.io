-- Issue #147: o RH abre a ficha de um candidato sem teste e nao tem como mandar o link.
--
-- `new_bfi_candidate_session(p_candidate, p_ticket)` (migration 20260917120000) exige um
-- ticket de candidatura — o que autoriza o candidato publico, anonimo. Quem esta na ficha e o
-- RH logado, sem ticket nenhum: chamar de la levanta 'Ticket invalido para este candidato.'
--
-- Entao a porta do RH e outra, com a autorizacao que o dashboard ja usa para ler candidato
-- (policy `candidates_select_perm`): `can_access` da equipe. A mecanica da sessao e a mesma —
-- reaproveita a que esta em aberto, 7 dias de validade, um preenchimento.

CREATE OR REPLACE FUNCTION public.new_bfi_session_for_staff(p_candidate uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  IF NOT (public.can_access('central_candidato', 'view')
          OR public.can_access('talentos', 'view')
          OR public.can_access('recrutamento', 'view')
          OR public.can_access('vagas', 'view')) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = p_candidate) THEN
    RAISE EXCEPTION 'Candidato nao encontrado.';
  END IF;

  -- Uma sessao por pessoa por vez: clicar duas vezes nao multiplica teste em aberto.
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

REVOKE ALL ON FUNCTION public.new_bfi_session_for_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.new_bfi_session_for_staff(uuid) TO authenticated;
