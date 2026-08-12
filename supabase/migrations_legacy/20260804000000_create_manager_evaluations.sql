-- Portal do Gestor: avaliação de candidatos no processo seletivo.
-- O gestor recebe candidatos indicados pelo RH (job_applications com status 'Entrevista Gestor')
-- e decide: Aprovado → avança para próxima fase | Reprovado → encerra candidatura.
--
-- manager_evaluations registra a decisão do gestor + comentário, com rastreabilidade.

CREATE TABLE IF NOT EXISTS public.manager_evaluations (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES public.job_applications(id) ON DELETE CASCADE,
    candidate_id   UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    job_request_id UUID REFERENCES public.job_requests(id) ON DELETE SET NULL,
    evaluator_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- gestor que avaliou
    decision       VARCHAR(20) NOT NULL CHECK (decision IN ('Aprovado', 'Reprovado', 'Pendente')),
    comment        TEXT,
    evaluated_at   TIMESTAMPTZ DEFAULT NOW(),
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Adiciona coluna manager_evaluation_id em job_applications para linkagem rápida
ALTER TABLE public.job_applications
    ADD COLUMN IF NOT EXISTS manager_decision VARCHAR(20)
        CHECK (manager_decision IN ('Aprovado', 'Reprovado', 'Pendente'));

-- RLS: fail-closed
ALTER TABLE public.manager_evaluations ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON public.manager_evaluations FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manager_evaluations TO authenticated;

-- Gestor pode ver avaliações de candidatos de vagas que ele criou ou onde foi atribuído
CREATE POLICY "manager_evaluations_select"
  ON public.manager_evaluations FOR SELECT TO authenticated
  USING (
    public.can_access('recrutamento'::text, 'view'::text)
    OR evaluator_id = auth.uid()
  );

CREATE POLICY "manager_evaluations_insert"
  ON public.manager_evaluations FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access('recrutamento'::text, 'view'::text)
    OR evaluator_id = auth.uid()
  );

CREATE POLICY "manager_evaluations_admin"
  ON public.manager_evaluations FOR ALL TO authenticated
  USING (public.can_access('recrutamento'::text, 'edit'::text))
  WITH CHECK (public.can_access('recrutamento'::text, 'edit'::text));

-- Index para consultas por vaga e por avaliador
CREATE INDEX IF NOT EXISTS idx_manager_evaluations_job ON public.manager_evaluations(job_request_id);
CREATE INDEX IF NOT EXISTS idx_manager_evaluations_evaluator ON public.manager_evaluations(evaluator_id);
