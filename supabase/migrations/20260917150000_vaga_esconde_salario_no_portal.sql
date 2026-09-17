-- A Vaga decide se o salario aparece no portal de carreiras (pedido do usuario, 2026-09-17).
--
-- O ponto NAO e a interface. `job_openings` tem RLS de leitura anonima
-- (`job_openings_public_select`, baseline linha 4533) e o portal recebe o JSON inteiro: esconder
-- o numero so no React deixaria o valor a um devtools de distancia. Entao o salario nao e
-- escondido -- ele nao e COPIADO para a tabela publica. O valor continua em `job_requests`,
-- atras de login, que e onde o RH precisa dele.
--
-- Por isso nao existe coluna `hide_salary` em `job_openings`: nao ha o que marcar quando o dado
-- simplesmente nao esta la. O portal mostra "A combinar" quando nao ha salario -- que e verdade
-- tanto para a vaga que esconde quanto para a que nunca informou.

ALTER TABLE public.job_requests
  ADD COLUMN IF NOT EXISTS hide_salary boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.job_requests.hide_salary IS
  'true = o salario nao e copiado para job_openings e o portal mostra "A combinar".';

-- Vaga nova nasce escondendo (o DEFAULT acima). As que ja existem continuam como estao: mudar o
-- anuncio de uma vaga no ar sem ninguem pedir seria pior que o problema que isto resolve.
UPDATE public.job_requests SET hide_salary = false;

-- A funcao abaixo e a de `20260902160000_job_workplace_id.sql` -- a versao viva, que sincroniza
-- `workplace_id` -- com as duas linhas de salario trocadas por um CASE. Copiada de la de
-- proposito: `CREATE OR REPLACE` a partir de uma versao antiga silenciosamente desfaz o que veio
-- depois, e foi o que quase aconteceu aqui.

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
      CASE WHEN NEW.hide_salary THEN NULL ELSE NEW.salary_min END,
      CASE WHEN NEW.hide_salary THEN NULL ELSE NEW.salary_max END,
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


-- `hide_salary` entra na lista de colunas do trigger. Sem isso, marcar ou desmarcar a opcao numa
-- vaga JA aprovada nao dispara sincronizacao nenhuma, e a mudanca nunca chega ao portal --
-- exatamente o que o teste do gatilho pegou.

DROP TRIGGER IF EXISTS sync_approved_job_request_to_opening ON public.job_requests;
CREATE TRIGGER sync_approved_job_request_to_opening
AFTER INSERT OR UPDATE OF status, profile_id, department_id, unit, contract_type, justification, target_date, notes, manager_expectations, required_requirements, benefits, salary_min, salary_max, seniority, work_mode, is_pcd_eligible, affirmative_tags, workplace_id, hide_salary
ON public.job_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_approved_job_request_to_opening();
