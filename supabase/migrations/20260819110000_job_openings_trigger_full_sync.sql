ALTER TABLE public.job_requests
  ADD COLUMN IF NOT EXISTS work_mode text,
  ADD COLUMN IF NOT EXISTS is_pcd_eligible boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS affirmative_tags text[] DEFAULT '{}'::text[];

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
      benefits,
      salary_min,
      salary_max,
      seniority,
      work_mode,
      is_pcd_eligible,
      affirmative_tags
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
      COALESCE(NEW.benefits, ARRAY[]::text[]),
      NEW.salary_min,
      NEW.salary_max,
      NEW.seniority,
      NEW.work_mode,
      NEW.is_pcd_eligible,
      NEW.affirmative_tags
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
      benefits = EXCLUDED.benefits,
      salary_min = EXCLUDED.salary_min,
      salary_max = EXCLUDED.salary_max,
      seniority = EXCLUDED.seniority,
      work_mode = EXCLUDED.work_mode,
      is_pcd_eligible = EXCLUDED.is_pcd_eligible,
      affirmative_tags = EXCLUDED.affirmative_tags;
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
AFTER INSERT OR UPDATE OF status, profile_id, department_id, unit, contract_type, justification, target_date, notes, manager_expectations, required_requirements, benefits, salary_min, salary_max, seniority, work_mode, is_pcd_eligible, affirmative_tags
ON public.job_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_approved_job_request_to_opening();

UPDATE public.job_openings jo
SET
  salary_min = jr.salary_min,
  salary_max = jr.salary_max,
  seniority = jr.seniority,
  work_mode = jr.work_mode,
  is_pcd_eligible = jr.is_pcd_eligible,
  affirmative_tags = jr.affirmative_tags
FROM public.job_requests jr
WHERE jo.job_request_id = jr.id;
