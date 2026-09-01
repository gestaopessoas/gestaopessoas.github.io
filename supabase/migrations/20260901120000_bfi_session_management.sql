-- The normalize migration (20260814203145) dropped candidate_big_five_results.raw_answers
-- and moved answers into candidate_big_five_answers, but the test pages still wrote directly
-- to raw_answers, so every submission failed. Route writes through SECURITY DEFINER RPCs
-- instead (also lets us enforce "answer once" and expiry server-side, and lets HR revoke a
-- generated link). The old blanket "true/true" update policy is dropped since anon writes
-- now go through the RPCs, which validate expiry/one-time-use themselves.

ALTER TABLE public.candidate_big_five_results
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.submit_bfi_answers(p_session_id uuid, p_answers jsonb)
RETURNS SETOF public.candidate_big_five_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  session_row public.candidate_big_five_results;
BEGIN
  SELECT * INTO session_row FROM public.candidate_big_five_results WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessao nao encontrada.';
  END IF;

  IF session_row.expires_at IS NOT NULL AND session_row.expires_at < now() THEN
    RAISE EXCEPTION 'Link expirado.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.candidate_big_five_answers WHERE result_id = p_session_id) THEN
    RAISE EXCEPTION 'Esta sessao ja foi respondida.';
  END IF;

  INSERT INTO public.candidate_big_five_answers (result_id, item_number, answer)
  SELECT p_session_id,
         COALESCE(question.item_number, (answer.key)::integer),
         (answer.value #>> '{}')::numeric
  FROM jsonb_each(p_answers) AS answer(key, value)
  LEFT JOIN public.big_five_questions AS question ON question.id::text = answer.key;

  RETURN QUERY SELECT * FROM public.candidate_big_five_results WHERE id = p_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_bfi_answers(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_bfi_answers(uuid, jsonb) TO anon, authenticated;

-- Public self-serve candidate flow (candidato/teste-personalidade): creates the result row
-- and its answers in one shot, since no HR-generated session link exists for that path.
CREATE OR REPLACE FUNCTION public.submit_bfi_candidate_answers(p_candidate_id uuid, p_answers jsonb)
RETURNS SETOF public.candidate_big_five_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.candidate_big_five_results (candidate_id) VALUES (p_candidate_id) RETURNING id INTO new_id;

  INSERT INTO public.candidate_big_five_answers (result_id, item_number, answer)
  SELECT new_id,
         COALESCE(question.item_number, (answer.key)::integer),
         (answer.value #>> '{}')::numeric
  FROM jsonb_each(p_answers) AS answer(key, value)
  LEFT JOIN public.big_five_questions AS question ON question.id::text = answer.key;

  RETURN QUERY SELECT * FROM public.candidate_big_five_results WHERE id = new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_bfi_candidate_answers(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_bfi_candidate_answers(uuid, jsonb) TO anon, authenticated;

DROP POLICY IF EXISTS "Candidates can update results" ON public.candidate_big_five_results;

CREATE POLICY "candidate_big_five_results_hr_update" ON public.candidate_big_five_results
  FOR UPDATE TO authenticated
  USING (public.can_access('colaboradores', 'edit') OR public.can_access('talentos', 'edit') OR public.can_access('recrutamento', 'edit'))
  WITH CHECK (public.can_access('colaboradores', 'edit') OR public.can_access('talentos', 'edit') OR public.can_access('recrutamento', 'edit'));

CREATE POLICY "candidate_big_five_results_hr_delete" ON public.candidate_big_five_results
  FOR DELETE TO authenticated
  USING (public.can_access('colaboradores', 'edit') OR public.can_access('talentos', 'edit') OR public.can_access('recrutamento', 'edit'));
