-- Big Five goals are structured numeric ranges, not JSON payloads.
-- The old columns are empty in production; replacing them therefore preserves all values.
ALTER TABLE public.job_profiles
  DROP COLUMN IF EXISTS ideal_openness,
  DROP COLUMN IF EXISTS ideal_conscientiousness,
  DROP COLUMN IF EXISTS ideal_extraversion,
  DROP COLUMN IF EXISTS ideal_agreeableness,
  DROP COLUMN IF EXISTS ideal_neuroticism,
  ADD COLUMN IF NOT EXISTS ideal_openness_min numeric,
  ADD COLUMN IF NOT EXISTS ideal_openness_max numeric,
  ADD COLUMN IF NOT EXISTS ideal_conscientiousness_min numeric,
  ADD COLUMN IF NOT EXISTS ideal_conscientiousness_max numeric,
  ADD COLUMN IF NOT EXISTS ideal_extraversion_min numeric,
  ADD COLUMN IF NOT EXISTS ideal_extraversion_max numeric,
  ADD COLUMN IF NOT EXISTS ideal_agreeableness_min numeric,
  ADD COLUMN IF NOT EXISTS ideal_agreeableness_max numeric,
  ADD COLUMN IF NOT EXISTS ideal_neuroticism_min numeric,
  ADD COLUMN IF NOT EXISTS ideal_neuroticism_max numeric;

ALTER TABLE public.job_requests
  DROP COLUMN IF EXISTS ideal_openness,
  DROP COLUMN IF EXISTS ideal_conscientiousness,
  DROP COLUMN IF EXISTS ideal_extraversion,
  DROP COLUMN IF EXISTS ideal_agreeableness,
  DROP COLUMN IF EXISTS ideal_neuroticism,
  ADD COLUMN IF NOT EXISTS ideal_openness_min numeric,
  ADD COLUMN IF NOT EXISTS ideal_openness_max numeric,
  ADD COLUMN IF NOT EXISTS ideal_conscientiousness_min numeric,
  ADD COLUMN IF NOT EXISTS ideal_conscientiousness_max numeric,
  ADD COLUMN IF NOT EXISTS ideal_extraversion_min numeric,
  ADD COLUMN IF NOT EXISTS ideal_extraversion_max numeric,
  ADD COLUMN IF NOT EXISTS ideal_agreeableness_min numeric,
  ADD COLUMN IF NOT EXISTS ideal_agreeableness_max numeric,
  ADD COLUMN IF NOT EXISTS ideal_neuroticism_min numeric,
  ADD COLUMN IF NOT EXISTS ideal_neuroticism_max numeric;

-- Persist each submitted answer in a row so it can be queried and joined to its question.
CREATE TABLE IF NOT EXISTS public.candidate_big_five_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid NOT NULL REFERENCES public.candidate_big_five_results(id) ON DELETE CASCADE,
  item_number integer NOT NULL,
  answer numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (result_id, item_number)
);

DROP POLICY IF EXISTS "Candidates can fill their own session once" ON public.candidate_big_five_results;
DROP TRIGGER IF EXISTS trigger_calculate_bfi_scores ON public.candidate_big_five_results;
DROP FUNCTION IF EXISTS public.calculate_bfi_scores();

CREATE OR REPLACE FUNCTION public.refresh_candidate_big_five_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_result_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_result_id := OLD.result_id;
  ELSE
    target_result_id := NEW.result_id;
  END IF;

  UPDATE public.candidate_big_five_results AS result
  SET openness_score = scores.openness_score,
      conscientiousness_score = scores.conscientiousness_score,
      extraversion_score = scores.extraversion_score,
      agreeableness_score = scores.agreeableness_score,
      neuroticism_score = scores.neuroticism_score
  FROM (
    SELECT
      ROUND(AVG(CASE WHEN question.is_reverse_scored THEN 6 - answer.answer ELSE answer.answer END)
        FILTER (WHERE question.domain = 'O'), 2) AS openness_score,
      ROUND(AVG(CASE WHEN question.is_reverse_scored THEN 6 - answer.answer ELSE answer.answer END)
        FILTER (WHERE question.domain = 'C'), 2) AS conscientiousness_score,
      ROUND(AVG(CASE WHEN question.is_reverse_scored THEN 6 - answer.answer ELSE answer.answer END)
        FILTER (WHERE question.domain = 'E'), 2) AS extraversion_score,
      ROUND(AVG(CASE WHEN question.is_reverse_scored THEN 6 - answer.answer ELSE answer.answer END)
        FILTER (WHERE question.domain = 'A'), 2) AS agreeableness_score,
      ROUND(AVG(CASE WHEN question.is_reverse_scored THEN 6 - answer.answer ELSE answer.answer END)
        FILTER (WHERE question.domain = 'N'), 2) AS neuroticism_score
    FROM public.candidate_big_five_answers AS answer
    JOIN public.big_five_questions AS question ON question.item_number = answer.item_number
    WHERE answer.result_id = target_result_id
  ) AS scores
  WHERE result.id = target_result_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_candidate_big_five_scores() FROM PUBLIC;

CREATE TRIGGER trigger_refresh_bfi_scores
AFTER INSERT OR UPDATE OR DELETE ON public.candidate_big_five_answers
FOR EACH ROW EXECUTE FUNCTION public.refresh_candidate_big_five_scores();

INSERT INTO public.candidate_big_five_answers (result_id, item_number, answer)
SELECT result.id,
       COALESCE(question.item_number, answer.key::integer),
       (answer.value #>> '{}')::numeric
FROM public.candidate_big_five_results AS result
CROSS JOIN LATERAL jsonb_each(result.raw_answers) AS answer(key, value)
LEFT JOIN public.big_five_questions AS question ON question.id::text = answer.key
WHERE jsonb_typeof(result.raw_answers) = 'object'
  AND (question.id IS NOT NULL OR answer.key ~ '^[0-9]+$')
  AND jsonb_typeof(answer.value) = 'number'
ON CONFLICT (result_id, item_number) DO UPDATE
SET answer = EXCLUDED.answer;

ALTER TABLE public.candidate_big_five_results
  DROP COLUMN IF EXISTS raw_answers;

ALTER TABLE public.candidate_big_five_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "HR can manage Big Five answers" ON public.candidate_big_five_answers;
CREATE POLICY "HR can manage Big Five answers"
  ON public.candidate_big_five_answers
  FOR ALL TO authenticated
  USING (public.can_access('central_candidato', 'edit'))
  WITH CHECK (public.can_access('central_candidato', 'edit'));
