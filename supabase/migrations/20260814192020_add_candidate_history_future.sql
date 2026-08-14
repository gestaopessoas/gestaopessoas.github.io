ALTER TABLE public.candidate_interviews
  ADD COLUMN IF NOT EXISTS candidate_future text,
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS created_by_name text;

CREATE OR REPLACE FUNCTION public.set_candidate_interview_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.created_by_user_id := auth.uid();

  SELECT name
  INTO NEW.created_by_name
  FROM public.profiles
  WHERE id = NEW.created_by_user_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_candidate_interview_author() FROM PUBLIC;

DROP TRIGGER IF EXISTS set_candidate_interview_author ON public.candidate_interviews;
CREATE TRIGGER set_candidate_interview_author
BEFORE INSERT ON public.candidate_interviews
FOR EACH ROW
EXECUTE FUNCTION public.set_candidate_interview_author();
