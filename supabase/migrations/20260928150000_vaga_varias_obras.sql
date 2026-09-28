-- #163: vaga cobre uma ou mais obras; o centro de custo passa a vir da obra.
--
-- 1. workplaces.cost_center_id: centro de custo da obra.
-- 2. job_requests.workplace_ids substitui job_requests.workplace_id (backfill e drop).
-- 3. O trigger que copia a vaga aprovada para job_openings continua gravando uma obra so em
--    job_openings.workplace_id: a obra quando a vaga tem exatamente uma, NULL quando tem varias
--    (a obra de cada candidato e escolhida pelo RH no andamento).
--    ponytail: job_openings segue com uma obra; vira array quando a Central precisar filtrar por varias.
--
-- employees.workplace_id e outra coluna (obra do colaborador) e nao muda.

ALTER TABLE public.workplaces
  ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL;

ALTER TABLE public.job_requests
  ADD COLUMN IF NOT EXISTS workplace_ids uuid[] NOT NULL DEFAULT '{}';

-- Gatilho com plano em cache ja engoliu coluna recem-criada neste banco.
DISCARD PLANS;

UPDATE public.job_requests
SET workplace_ids = ARRAY[workplace_id]
WHERE workplace_id IS NOT NULL
  AND workplace_ids = '{}';

CREATE INDEX IF NOT EXISTS job_requests_workplace_ids_idx
  ON public.job_requests USING gin (workplace_ids);

-- Corpo identico ao de 20260902160000_job_workplace_id.sql, trocando NEW.workplace_id pela obra
-- unica de NEW.workplace_ids.
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
      affirmative_tags,
      workplace_id
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
      NEW.affirmative_tags,
      CASE WHEN cardinality(NEW.workplace_ids) = 1 THEN NEW.workplace_ids[1] END
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
      affirmative_tags = EXCLUDED.affirmative_tags,
      workplace_id = EXCLUDED.workplace_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'Aprovada' THEN
    UPDATE public.job_openings
    SET status = 'Fechada'
    WHERE job_request_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_approved_job_request_to_opening() FROM PUBLIC;

-- O trigger lista workplace_id em UPDATE OF; precisa sair antes do drop da coluna.
DROP TRIGGER IF EXISTS sync_approved_job_request_to_opening ON public.job_requests;
CREATE TRIGGER sync_approved_job_request_to_opening
AFTER INSERT OR UPDATE OF status, profile_id, department_id, unit, contract_type, justification, target_date, notes, manager_expectations, required_requirements, benefits, salary_min, salary_max, seniority, work_mode, is_pcd_eligible, affirmative_tags, workplace_ids
ON public.job_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_approved_job_request_to_opening();

DROP INDEX IF EXISTS public.job_requests_workplace_id_idx;
ALTER TABLE public.job_requests DROP COLUMN IF EXISTS workplace_id;
