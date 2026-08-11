-- Audit 2026-07-31, A3: evaluation_cycles e goals não existiam no banco real (drift de schema).
-- As migrations declaram (g4_to_g7_tables), mas o remote nunca recebeu as tabelas.
-- Recria com RLS fail-closed (ADR 0002) + policies can_access.

CREATE TABLE IF NOT EXISTS public.evaluation_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(10) CHECK (type IN ('90', '180', '360', 'experiencia')),
    starts_at DATE NOT NULL,
    ends_at DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'FINISHED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.evaluation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_id UUID REFERENCES public.evaluation_cycles(id) ON DELETE CASCADE,
    evaluatee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    evaluator_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    relationship VARCHAR(50) CHECK (relationship IN ('self', 'gestor', 'par', 'subordinado')),
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.evaluation_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.evaluation_requests(id) ON DELETE CASCADE,
    question_key VARCHAR(50),
    answer_value NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type VARCHAR(50) CHECK (owner_type IN ('empresa', 'depto', 'pessoa')),
    owner_id UUID,
    title VARCHAR(255) NOT NULL,
    metric VARCHAR(255) NOT NULL,
    target NUMERIC NOT NULL,
    current NUMERIC DEFAULT 0,
    period VARCHAR(50),
    parent_goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: fail-closed (nenhum acesso sem can_access)
ALTER TABLE public.evaluation_cycles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_answers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals               ENABLE ROW LEVEL SECURITY;

-- Grants: anon nada; authenticated via policies
REVOKE ALL PRIVILEGES ON public.evaluation_cycles   FROM anon;
REVOKE ALL PRIVILEGES ON public.evaluation_requests FROM anon;
REVOKE ALL PRIVILEGES ON public.evaluation_answers  FROM anon;
REVOKE ALL PRIVILEGES ON public.goals               FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_cycles   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluation_answers  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals               TO authenticated;

-- Policies can_access
CREATE POLICY "evaluation_cycles_select"
  ON public.evaluation_cycles FOR SELECT TO authenticated
  USING (public.can_access('avaliacoes'::text, 'view'::text) OR public.can_access('gestao'::text, 'view'::text));

CREATE POLICY "evaluation_cycles_admin_all"
  ON public.evaluation_cycles FOR ALL TO authenticated
  USING (public.can_access('avaliacoes'::text, 'edit'::text))
  WITH CHECK (public.can_access('avaliacoes'::text, 'edit'::text));

CREATE POLICY "evaluation_requests_select"
  ON public.evaluation_requests FOR SELECT TO authenticated
  USING (public.can_access('avaliacoes'::text, 'view'::text) OR auth.uid() = (
    SELECT user_id FROM public.employees WHERE id = evaluatee_id
  ));

CREATE POLICY "evaluation_requests_admin_all"
  ON public.evaluation_requests FOR ALL TO authenticated
  USING (public.can_access('avaliacoes'::text, 'edit'::text))
  WITH CHECK (public.can_access('avaliacoes'::text, 'edit'::text));

CREATE POLICY "evaluation_answers_select"
  ON public.evaluation_answers FOR SELECT TO authenticated
  USING (public.can_access('avaliacoes'::text, 'view'::text));

CREATE POLICY "evaluation_answers_admin_all"
  ON public.evaluation_answers FOR ALL TO authenticated
  USING (public.can_access('avaliacoes'::text, 'edit'::text))
  WITH CHECK (public.can_access('avaliacoes'::text, 'edit'::text));

CREATE POLICY "goals_select"
  ON public.goals FOR SELECT TO authenticated
  USING (public.can_access('metas'::text, 'view'::text) OR public.can_access('gestao'::text, 'view'::text));

CREATE POLICY "goals_admin_all"
  ON public.goals FOR ALL TO authenticated
  USING (public.can_access('metas'::text, 'edit'::text))
  WITH CHECK (public.can_access('metas'::text, 'edit'::text));

-- Policies fail-closed anon
CREATE POLICY "evaluation_cycles_no_anon"   ON public.evaluation_cycles   FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "evaluation_requests_no_anon" ON public.evaluation_requests FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "evaluation_answers_no_anon"  ON public.evaluation_answers  FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "goals_no_anon"               ON public.goals               FOR ALL TO anon USING (false) WITH CHECK (false);
