-- Fase 0 do eixo unico de Etapa (docs/adr/0006, secao "Exclusividade de Obra", issue #55).
--
-- Nem job_requests nem job_openings sabiam a sua Obra. O que existia era job_requests.unit,
-- rotulado no formulario como "Unidade / Centro de Custo" e preenchido a partir da lista de
-- centros de custo -- que nao e a mesma coisa, ja que uma Obra tem varios. Por falta do dado o
-- VagaForm chutava por substring (unitUpper.includes("OBRA")). A Fase 1 precisa da Obra da Vaga
-- para avaliar a Exclusividade de Obra, que hoje mora em check_active_workplace_lock e depende
-- de workplace_name em texto livre.
--
-- Nullable de proposito: vaga antiga cuja Obra ninguem consegue determinar fica NULL, e a
-- Exclusividade de Obra simplesmente nao opina sobre Candidatura sem Obra. NOT NULL com uma Obra
-- sintetica "Nao informada" faria duas candidaturas nela se bloquearem por um motivo falso.
-- Preencher e obrigatorio no formulario, da vaga nova em diante.
--
-- ON DELETE SET NULL acompanha as outras FKs de job_openings. Obra nao e excluida no fluxo
-- normal (obras/page.tsx arquiva com status = 'Inativo'), entao isso e rede de seguranca.

ALTER TABLE public.job_requests
  ADD COLUMN IF NOT EXISTS workplace_id uuid REFERENCES public.workplaces(id) ON DELETE SET NULL;

ALTER TABLE public.job_openings
  ADD COLUMN IF NOT EXISTS workplace_id uuid REFERENCES public.workplaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS job_requests_workplace_id_idx
  ON public.job_requests (workplace_id);

CREATE INDEX IF NOT EXISTS job_openings_workplace_id_idx
  ON public.job_openings (workplace_id);

-- O trigger de sincronizacao passa a copiar workplace_id junto com o resto. Corpo identico ao de
-- 20260819110000_job_openings_trigger_full_sync.sql, so com a coluna nova somada nos tres pontos
-- (lista de colunas, VALUES e DO UPDATE SET).
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
      NEW.workplace_id
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

DROP TRIGGER IF EXISTS sync_approved_job_request_to_opening ON public.job_requests;
CREATE TRIGGER sync_approved_job_request_to_opening
AFTER INSERT OR UPDATE OF status, profile_id, department_id, unit, contract_type, justification, target_date, notes, manager_expectations, required_requirements, benefits, salary_min, salary_max, seniority, work_mode, is_pcd_eligible, affirmative_tags, workplace_id
ON public.job_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_approved_job_request_to_opening();
