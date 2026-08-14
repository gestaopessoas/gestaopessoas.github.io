CREATE TABLE public.training_satisfaction_metrics (
  training_session_id uuid PRIMARY KEY REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  respondents integer NOT NULL DEFAULT 0,
  average_score numeric(5,2),
  weighted_utilization_score numeric(5,2),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.training_satisfaction_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_session_id uuid NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  feedback_type text NOT NULL CHECK (feedback_type IN ('like', 'improvement')),
  content text NOT NULL,
  position integer NOT NULL DEFAULT 0
);

ALTER TABLE public.training_satisfaction_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_satisfaction_feedback ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_satisfaction_metrics, public.training_satisfaction_feedback TO authenticated;
CREATE POLICY training_satisfaction_metrics_access ON public.training_satisfaction_metrics FOR ALL TO authenticated USING (public.can_access('treinamentos','view')) WITH CHECK (public.can_access('treinamentos','edit') OR public.can_access('treinamentos','create'));
CREATE POLICY training_satisfaction_feedback_access ON public.training_satisfaction_feedback FOR ALL TO authenticated USING (public.can_access('treinamentos','view')) WITH CHECK (public.can_access('treinamentos','edit') OR public.can_access('treinamentos','create'));

INSERT INTO public.training_satisfaction_metrics (training_session_id, respondents, average_score, weighted_utilization_score)
SELECT id, COALESCE((satisfaction_metrics->>'respondents')::integer,0), NULLIF(satisfaction_metrics->>'average_score','')::numeric, NULLIF(satisfaction_metrics->>'weighted_utilization_score','')::numeric
FROM public.training_sessions WHERE satisfaction_metrics IS NOT NULL;

INSERT INTO public.training_satisfaction_feedback (training_session_id, feedback_type, content, position)
SELECT id, 'like', value, ordinality - 1 FROM public.training_sessions, jsonb_array_elements_text(COALESCE(satisfaction_metrics->'feedback_likes','[]'::jsonb)) WITH ORDINALITY
UNION ALL
SELECT id, 'improvement', value, ordinality - 1 FROM public.training_sessions, jsonb_array_elements_text(COALESCE(satisfaction_metrics->'feedback_improvements','[]'::jsonb)) WITH ORDINALITY;

ALTER TABLE public.training_sessions DROP COLUMN satisfaction_metrics;
