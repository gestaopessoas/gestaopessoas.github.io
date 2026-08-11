-- Audit 2026-07-31, #1.2: candidate_interviews RLS sem checagem de papel.
-- Antes: 4 policies com auth.role() = 'authenticated' -> qualquer logado lê/insere/edita/apaga qualquer entrevista (inclui rejection_reason/notes).
-- Depois: gate por can_access('central_candidato', action), mesmo padrão de vagas/interviews e do gate de menu do Sidebar.

DROP POLICY IF EXISTS "Authenticated users can select candidate_interviews" ON public.candidate_interviews;
DROP POLICY IF EXISTS "Authenticated users can insert candidate_interviews" ON public.candidate_interviews;
DROP POLICY IF EXISTS "Authenticated users can update candidate_interviews" ON public.candidate_interviews;
DROP POLICY IF EXISTS "Authenticated users can delete candidate_interviews" ON public.candidate_interviews;

CREATE POLICY "candidate_interviews_select" ON public.candidate_interviews
  FOR SELECT TO authenticated
  USING (public.can_access('central_candidato'::text, 'view'::text));

CREATE POLICY "candidate_interviews_insert" ON public.candidate_interviews
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access('central_candidato'::text, 'create'::text)
           OR public.can_access('central_candidato'::text, 'edit'::text));

CREATE POLICY "candidate_interviews_update" ON public.candidate_interviews
  FOR UPDATE TO authenticated
  USING (public.can_access('central_candidato'::text, 'edit'::text))
  WITH CHECK (public.can_access('central_candidato'::text, 'edit'::text));

CREATE POLICY "candidate_interviews_delete" ON public.candidate_interviews
  FOR DELETE TO authenticated
  USING (public.can_access('central_candidato'::text, 'delete'::text));
