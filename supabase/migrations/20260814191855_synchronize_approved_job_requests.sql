ALTER TABLE public.job_openings
  ADD COLUMN IF NOT EXISTS job_request_id uuid REFERENCES public.job_requests(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS job_openings_job_request_id_unique
  ON public.job_openings (job_request_id)
  WHERE job_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_approved_job_request_to_opening()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'Aprovada' THEN
    INSERT INTO public.job_openings (
      job_request_id,
      profile_id,
      department_id,
      cost_center,
      contract_type,
      justification,
      target_date,
      observations,
      status,
      created_by,
      benefits
    ) VALUES (
      NEW.id,
      NEW.profile_id,
      NEW.department_id,
      NEW.unit,
      NEW.contract_type,
      NEW.justification,
      NEW.target_date,
      COALESCE(NULLIF(NEW.notes, ''), NULLIF(NEW.manager_expectations, ''), NULLIF(NEW.required_requirements, '')),
      'Aberta',
      NEW.requester_name,
      COALESCE(NEW.benefits, ARRAY[]::text[])
    )
    ON CONFLICT (job_request_id) WHERE job_request_id IS NOT NULL DO UPDATE SET
      profile_id = EXCLUDED.profile_id,
      department_id = EXCLUDED.department_id,
      cost_center = EXCLUDED.cost_center,
      contract_type = EXCLUDED.contract_type,
      justification = EXCLUDED.justification,
      target_date = EXCLUDED.target_date,
      observations = EXCLUDED.observations,
      status = 'Aberta',
      benefits = EXCLUDED.benefits;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'Aprovada' THEN
    UPDATE public.job_openings
    SET status = 'Fechada'
    WHERE job_request_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_approved_job_request_to_opening() FROM PUBLIC;

DROP TRIGGER IF EXISTS sync_approved_job_request_to_opening ON public.job_requests;
CREATE TRIGGER sync_approved_job_request_to_opening
AFTER INSERT OR UPDATE OF status, profile_id, department_id, unit, contract_type, justification, target_date, notes, manager_expectations, required_requirements, benefits
ON public.job_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_approved_job_request_to_opening();

INSERT INTO public.job_openings (
  job_request_id,
  profile_id,
  department_id,
  cost_center,
  contract_type,
  justification,
  target_date,
  observations,
  status,
  created_by,
  benefits
)
SELECT
  jr.id,
  jr.profile_id,
  jr.department_id,
  jr.unit,
  jr.contract_type,
  jr.justification,
  jr.target_date,
  COALESCE(NULLIF(jr.notes, ''), NULLIF(jr.manager_expectations, ''), NULLIF(jr.required_requirements, '')),
  'Aberta',
  jr.requester_name,
  COALESCE(jr.benefits, ARRAY[]::text[])
FROM public.job_requests jr
WHERE jr.status = 'Aprovada'
ON CONFLICT (job_request_id) WHERE job_request_id IS NOT NULL DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  department_id = EXCLUDED.department_id,
  cost_center = EXCLUDED.cost_center,
  contract_type = EXCLUDED.contract_type,
  justification = EXCLUDED.justification,
  target_date = EXCLUDED.target_date,
  observations = EXCLUDED.observations,
  status = 'Aberta',
  benefits = EXCLUDED.benefits;
