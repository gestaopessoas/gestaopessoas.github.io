-- Audit 2026-07-31, #1.1 + #2.4 + #3.6 + #2.1 (trigger).
-- candidates: policies permissivas (auth.role()='authenticated') anulavam a policy restritiva por dono
--   (Postgres combina policies com OR). Drop e recria com gate can_access('central_candidato', ...) OU dono.
-- candidate_educations / candidate_experiences: SELECT apenas por can_access(view), mantendo INSERT público (portal de carreiras).
-- Índices ausentes em colunas usadas por RLS/joins.
-- Trigger check_active_workplace_lock: adiciona 'Contratado' à lista de saída do lock (alinhamento com UNLOCK_STAGES da UI).

-- ---------- candidates ----------
DROP POLICY IF EXISTS "Allow authenticated users to read candidates" ON public.candidates;
DROP POLICY IF EXISTS "Authenticated users can select candidates" ON public.candidates;
DROP POLICY IF EXISTS "Authenticated users can update candidates" ON public.candidates;

-- RH com acesso à Central lê qualquer candidato; candidato logado lê/edita o próprio perfil
CREATE POLICY "candidates_select_hr_or_owner"
  ON public.candidates FOR SELECT TO authenticated
  USING (public.can_access('central_candidato'::text, 'view'::text) OR auth.uid() = user_id);

CREATE POLICY "candidates_update_hr_or_owner"
  ON public.candidates FOR UPDATE TO authenticated
  USING (public.can_access('central_candidato'::text, 'edit'::text) OR auth.uid() = user_id)
  WITH CHECK (public.can_access('central_candidato'::text, 'edit'::text) OR auth.uid() = user_id);

-- (INSERT público permanece: "Public can insert candidates" em 20260713141000)

-- ---------- candidate_educations / candidate_experiences ----------
DROP POLICY IF EXISTS "Authenticated users can select educations" ON public.candidate_educations;
DROP POLICY IF EXISTS "Authenticated users can select experiences" ON public.candidate_experiences;
DROP POLICY IF EXISTS "candidate_educations_select" ON public.candidate_educations;
DROP POLICY IF EXISTS "candidate_experiences_select" ON public.candidate_experiences;

CREATE POLICY "candidate_educations_select"
  ON public.candidate_educations FOR SELECT TO authenticated
  USING (public.can_access('central_candidato'::text, 'view'::text));

CREATE POLICY "candidate_experiences_select"
  ON public.candidate_experiences FOR SELECT TO authenticated
  USING (public.can_access('central_candidato'::text, 'view'::text));

-- ---------- índices ----------
CREATE INDEX IF NOT EXISTS idx_candidate_interviews_candidate_id ON public.candidate_interviews (candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_interviews_job_application_id ON public.candidate_interviews (job_application_id);
CREATE INDEX IF NOT EXISTS idx_candidates_user_id ON public.candidates (user_id);
CREATE INDEX IF NOT EXISTS idx_candidate_educations_candidate_id ON public.candidate_educations (candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_experiences_candidate_id ON public.candidate_experiences (candidate_id);

-- ---------- trigger: lock também é liberado por "Contratado" ----------
CREATE OR REPLACE FUNCTION public.check_active_workplace_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_active_workplace TEXT;
BEGIN
  -- Estágios que ENCERRAM o processo (libera o candidato para outra obra)
  IF NEW.stage NOT IN ('Reprovado', 'Desistente', 'Banco de Talentos', 'Contratado') AND NEW.workplace_name IS NOT NULL THEN
    SELECT workplace_name INTO v_active_workplace
    FROM public.candidate_interviews
    WHERE candidate_id = NEW.candidate_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND stage NOT IN ('Reprovado', 'Desistente', 'Banco de Talentos', 'Contratado')
      AND workplace_name IS NOT NULL
      AND LOWER(TRIM(workplace_name)) != LOWER(TRIM(NEW.workplace_name))
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'O candidato já possui um processo ativo na obra %', v_active_workplace;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
