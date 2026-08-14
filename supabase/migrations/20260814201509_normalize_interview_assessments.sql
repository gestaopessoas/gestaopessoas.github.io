CREATE TABLE public.interview_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL UNIQUE REFERENCES public.interviews(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.interview_assessment_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.interview_assessments(id) ON DELETE CASCADE,
  field text NOT NULL,
  item_index integer NOT NULL DEFAULT 0,
  value text,
  UNIQUE (assessment_id, field, item_index)
);

CREATE INDEX interview_assessment_values_assessment_id_idx
  ON public.interview_assessment_values (assessment_id);

ALTER TABLE public.interview_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_assessment_values ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_assessment_values TO authenticated;

CREATE POLICY interview_assessments_access ON public.interview_assessments
  FOR ALL TO authenticated
  USING (public.can_access('central_candidato', 'view'))
  WITH CHECK (public.can_access('central_candidato', 'create') OR public.can_access('central_candidato', 'edit'));

CREATE POLICY interview_assessment_values_access ON public.interview_assessment_values
  FOR ALL TO authenticated
  USING (public.can_access('central_candidato', 'view'))
  WITH CHECK (public.can_access('central_candidato', 'create') OR public.can_access('central_candidato', 'edit'));

CREATE OR REPLACE FUNCTION pg_temp.flatten_interview_assessment(
  p_assessment_id uuid,
  p_value jsonb,
  p_path text DEFAULT '',
  p_item_index integer DEFAULT 0
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  item record;
  idx integer := 0;
BEGIN
  CASE jsonb_typeof(p_value)
    WHEN 'object' THEN
      FOR item IN SELECT key, value FROM jsonb_each(p_value) LOOP
        PERFORM pg_temp.flatten_interview_assessment(
          p_assessment_id,
          item.value,
          CASE WHEN p_path = '' THEN item.key ELSE p_path || '.' || item.key END,
          p_item_index
        );
      END LOOP;
    WHEN 'array' THEN
      FOR item IN SELECT value FROM jsonb_array_elements(p_value) LOOP
        PERFORM pg_temp.flatten_interview_assessment(p_assessment_id, item.value, p_path, idx);
        idx := idx + 1;
      END LOOP;
    ELSE
      INSERT INTO public.interview_assessment_values (assessment_id, field, item_index, value)
      VALUES (p_assessment_id, p_path, p_item_index, trim(both '"' from p_value::text))
      ON CONFLICT (assessment_id, field, item_index) DO UPDATE SET value = EXCLUDED.value;
  END CASE;
END;
$$;

INSERT INTO public.interview_assessments (interview_id)
SELECT id FROM public.interviews;

DO $$
DECLARE
  interview_row record;
  assessment_id uuid;
BEGIN
  FOR interview_row IN SELECT id, assessment FROM public.interviews WHERE assessment IS NOT NULL LOOP
    SELECT id INTO assessment_id FROM public.interview_assessments WHERE interview_id = interview_row.id;
    PERFORM pg_temp.flatten_interview_assessment(assessment_id, interview_row.assessment);
  END LOOP;
END;
$$;

ALTER TABLE public.interviews DROP COLUMN assessment;
