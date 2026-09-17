-- Issue #110: vaga com todas as posicoes em Contratado continuava Aprovada, a Publicacao
-- continuava Aberta e o portal seguia aceitando candidatura para posicao que nao existe.
--
-- Fechar e o mesmo caminho que ja funciona hoje quando o RH arquiva na mao: qualquer status
-- de job_requests diferente de 'Aprovada' faz sync_approved_job_request_to_opening levar a
-- Publicacao para 'Fechada'. Entao basta trocar o status da Vaga.
--
-- 'Preenchida' e um status novo, distinto de 'Arquivada': uma e vaga cumprida, a outra e
-- contratacao desistida, e a metrica de conversao precisa saber a diferenca.
-- job_requests.status e text sem CHECK, entao nao ha constraint a alterar.

CREATE OR REPLACE FUNCTION public.marcar_vaga_preenchida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request  uuid;
  v_quantity integer;
  v_hired    integer;
BEGIN
  -- O status ja chega canonico: etapa_canonica() roda em BEFORE (Fase 1 do ADR 0006).
  IF NEW.status IS DISTINCT FROM 'Contratado' OR NEW.job_opening_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT jo.job_request_id INTO v_request
    FROM public.job_openings jo
   WHERE jo.id = NEW.job_opening_id;

  -- Publicacao sem Vaga (Talento ACPO, espontanea) nao tem quantidade para encher.
  IF v_request IS NULL THEN
    RETURN NEW;
  END IF;

  -- So mexe em vaga viva. Recusada, Arquivada ou ja Preenchida nao voltam atras.
  SELECT COALESCE(jr.quantity, 1) INTO v_quantity
    FROM public.job_requests jr
   WHERE jr.id = v_request AND jr.status = 'Aprovada';

  IF v_quantity IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_hired
    FROM public.job_applications ja
   WHERE ja.job_opening_id = NEW.job_opening_id
     AND ja.status = 'Contratado';

  IF v_hired >= v_quantity THEN
    UPDATE public.job_requests
       SET status = 'Preenchida'
     WHERE id = v_request AND status = 'Aprovada';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.marcar_vaga_preenchida() FROM PUBLIC;

DROP TRIGGER IF EXISTS marcar_vaga_preenchida ON public.job_applications;
CREATE TRIGGER marcar_vaga_preenchida
AFTER INSERT OR UPDATE OF status ON public.job_applications
FOR EACH ROW
EXECUTE FUNCTION public.marcar_vaga_preenchida();

-- Backfill: vaga que ja encheu antes deste trigger existir continua publicada.
UPDATE public.job_requests jr
   SET status = 'Preenchida'
  WHERE jr.status = 'Aprovada'
    AND EXISTS (
      SELECT 1
        FROM public.job_openings jo
       WHERE jo.job_request_id = jr.id
         AND (SELECT count(*) FROM public.job_applications ja
               WHERE ja.job_opening_id = jo.id AND ja.status = 'Contratado') >= COALESCE(jr.quantity, 1)
    );

-- get_recruitment_metrics contava "solicitacoes abertas" por exclusao de lista fixa, entao
-- um status novo entraria como aberta. Copia identica da versao de 20260908120100, com
-- 'Preenchida' somada a lista.
CREATE OR REPLACE FUNCTION public.get_recruitment_metrics()
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
DECLARE
  v_month_start date := date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
  v_result      jsonb;
BEGIN
  WITH months AS (
    SELECT to_char(d, 'YYYY-MM') AS key
    FROM generate_series((v_month_start - INTERVAL '11 months')::date, v_month_start, INTERVAL '1 month') d
  ),
  emp_todos AS (
    SELECT e.id, e.status, e.admission_date, e.dismissed_at
    FROM public.employees_todos e
  ),
  emp_atual AS (
    SELECT e.id, e.status, COALESCE(w.name, cc.code, 'Sem alocação') AS unit_label
    FROM public.employees e
    LEFT JOIN public.workplaces w ON w.id = e.workplace_id
    LEFT JOIN public.cost_centers cc ON cc.id = e.cost_center_id
  ),
  admissions AS (
    SELECT to_char(e.admission_date, 'YYYY-MM') AS key, count(*) AS total
    FROM emp_todos e
    WHERE e.admission_date IS NOT NULL AND EXTRACT(YEAR FROM e.admission_date) BETWEEN 1950 AND 2030
    GROUP BY 1
  ),
  dismissals AS (
    SELECT to_char(e.dismissed_at::date, 'YYYY-MM') AS key, count(*) AS total
    FROM emp_todos e
    WHERE e.status = 'Desligado' AND e.dismissed_at IS NOT NULL
      AND EXTRACT(YEAR FROM e.dismissed_at) BETWEEN 1950 AND 2030
    GROUP BY 1
  ),
  units AS (
    SELECT e.unit_label AS label, count(*) AS total FROM emp_atual e
    WHERE e.status IS NULL OR e.status NOT IN ('Inativo','Desligado','Arquivo Morto')
    GROUP BY 1
  ),
  request_status AS (
    SELECT COALESCE(NULLIF(btrim(jr.status), ''), 'Sem status') AS label, count(*) AS total
    FROM job_requests jr GROUP BY 1
  ),
  application_status AS (
    SELECT COALESCE(NULLIF(btrim(ja.status), ''), 'Sem status') AS label, count(*) AS total
    FROM job_applications ja GROUP BY 1
  ),
  totals AS (
    SELECT
      (SELECT count(*) FROM emp_atual WHERE status IN ('Ativo','Férias','Afastado')) AS active_employees,
      (SELECT count(*) FROM emp_atual WHERE status IS NULL OR status NOT IN ('Inativo','Desligado','Arquivo Morto')) AS allocated_employees,
      (SELECT count(*) FROM job_requests WHERE status IS NULL OR status NOT IN ('Aprovada','Recusada','Cancelada','Fechada','Arquivada','Preenchida')) AS open_requests,
      (SELECT count(*) FROM job_requests WHERE urgency IN ('Crítica','Alta')) AS critical_requests,
      (SELECT count(*) FROM candidates) AS candidates,
      (SELECT count(*) FROM job_applications) AS applications,
      (SELECT count(*) FROM job_applications WHERE status = 'Contratado') AS hired,
      (SELECT count(*) FROM job_openings WHERE status = 'Aberta') AS open_jobs
  )
  SELECT jsonb_build_object(
    'active_employees', t.active_employees,
    'allocated_employees', t.allocated_employees,
    'open_requests', t.open_requests,
    'critical_requests', t.critical_requests,
    'candidates', t.candidates,
    'applications', t.applications,
    'hired', t.hired,
    'conversion', CASE WHEN t.applications > 0 THEN round(t.hired::numeric * 100 / t.applications) ELSE 0 END,
    'open_jobs', t.open_jobs,
    'request_status', COALESCE((SELECT jsonb_object_agg(label, total) FROM request_status), '{}'::jsonb),
    'application_status', COALESCE((SELECT jsonb_object_agg(label, total) FROM application_status), '{}'::jsonb),
    'units', COALESCE((SELECT jsonb_object_agg(label, total) FROM units), '{}'::jsonb),
    'admissions_by_month', (SELECT jsonb_agg(jsonb_build_object('key', m.key, 'count', COALESCE(a.total,0)) ORDER BY m.key)
                            FROM months m LEFT JOIN admissions a ON a.key = m.key),
    'dismissals_by_month', (SELECT jsonb_agg(jsonb_build_object('key', m.key, 'count', COALESCE(d.total,0)) ORDER BY m.key)
                            FROM months m LEFT JOIN dismissals d ON d.key = m.key)
  ) INTO v_result FROM totals t;

  RETURN v_result;
END; $$;

