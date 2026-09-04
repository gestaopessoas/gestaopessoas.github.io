-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.get_recruitment_metrics();
--   DROP FUNCTION IF EXISTS public.get_turnover_metrics();
--
-- Agregação de métricas no banco (issue #62).
--
-- Motivo: `max_rows = 1000` do PostgREST corta toda resposta em silêncio. As telas
-- de Analytics e de Turnover puxavam `employees` inteira para o browser (4.839
-- linhas hoje) e agregavam o resultado como se fosse o total — recebiam 1.000.
-- Todos os números dessas telas estavam calculados sobre ~20% da base: headcount,
-- admissões/demissões por mês, índice de turnover e histórico de desligamentos.
--
-- Agregar no Postgres resolve a correção e o egress de uma vez: as duas telas
-- passam de ~1 MB e ~300 KB para alguns KB.
--
-- As regras abaixo são a porta fiel do que as páginas faziam em JS, incluindo o
-- guard de data de src/app/dashboard/turnover/page.tsx e metricas-recrutamento
-- (ano entre 1950 e 2030 — o resto é lixo de migração; a base tem dismissed_at
-- em 0109, 2105 e 3013).
--
-- "Afastamentos por mês" ficou de fora: a tela consultava
-- `employee_history.new_value`, coluna que não existe. Todo carregamento da tela
-- devolvia HTTP 400 nessa query, o gráfico vinha vazio e o aviso "Dados parciais"
-- aparecia sempre. A tabela registra `column_name = 'status'` mas não guarda o
-- valor antigo nem o novo, então o dado não é computável hoje (issue #63).

CREATE OR REPLACE FUNCTION public.get_recruitment_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today       date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_month_start date := date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
  v_result      jsonb;
BEGIN
  WITH months AS (
    SELECT to_char(d, 'YYYY-MM') AS key
    FROM generate_series(
      (v_month_start - INTERVAL '11 months')::date,
      v_month_start,
      INTERVAL '1 month'
    ) d
  ),
  emp AS (
    SELECT
      e.id, e.status, e.admission_date, e.dismissed_at,
      COALESCE(w.name, cc.code, 'Sem alocação') AS unit_label
    FROM employees e
    LEFT JOIN workplaces w ON w.id = e.workplace_id
    LEFT JOIN cost_centers cc ON cc.id = e.cost_center_id
  ),
  admissions AS (
    SELECT to_char(e.admission_date, 'YYYY-MM') AS key, count(*) AS total
    FROM emp e
    WHERE e.admission_date IS NOT NULL
      AND EXTRACT(YEAR FROM e.admission_date) BETWEEN 1950 AND 2030
    GROUP BY 1
  ),
  dismissals AS (
    SELECT to_char(e.dismissed_at::date, 'YYYY-MM') AS key, count(*) AS total
    FROM emp e
    WHERE e.status = 'Desligado'
      AND e.dismissed_at IS NOT NULL
      AND EXTRACT(YEAR FROM e.dismissed_at) BETWEEN 1950 AND 2030
    GROUP BY 1
  ),
  units AS (
    SELECT e.unit_label AS label, count(*) AS total
    FROM emp e
    WHERE e.status IS NULL
       OR e.status NOT IN ('Inativo', 'Desligado', 'Arquivo Morto', 'inactive')
    GROUP BY 1
  ),
  request_status AS (
    SELECT COALESCE(NULLIF(btrim(jr.status), ''), 'Sem status') AS label, count(*) AS total
    FROM job_requests jr
    GROUP BY 1
  ),
  application_status AS (
    SELECT COALESCE(NULLIF(btrim(ja.status), ''), 'Sem status') AS label, count(*) AS total
    FROM job_applications ja
    GROUP BY 1
  ),
  totals AS (
    SELECT
      (SELECT count(*) FROM emp WHERE status IN ('Ativo', 'Férias', 'Afastado')) AS active_employees,
      (SELECT count(*) FROM emp
        WHERE status IS NULL OR status NOT IN ('Inativo', 'Desligado', 'Arquivo Morto', 'inactive')) AS allocated_employees,
      (SELECT count(*) FROM job_requests
        WHERE status IS NULL
           OR status NOT IN ('Aprovada', 'Recusada', 'Cancelada', 'Fechada', 'Arquivada')) AS open_requests,
      (SELECT count(*) FROM job_requests WHERE urgency IN ('Crítica', 'Alta')) AS critical_requests,
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
    'conversion', CASE WHEN t.applications > 0
                       THEN round(t.hired::numeric * 100 / t.applications)
                       ELSE 0 END,
    'open_jobs', t.open_jobs,
    'request_status', COALESCE((
      SELECT jsonb_object_agg(label, total) FROM request_status
    ), '{}'::jsonb),
    'application_status', COALESCE((
      SELECT jsonb_object_agg(label, total) FROM application_status
    ), '{}'::jsonb),
    'units', COALESCE((SELECT jsonb_object_agg(label, total) FROM units), '{}'::jsonb),
    'admissions_by_month', (
      SELECT jsonb_agg(jsonb_build_object('key', m.key, 'count', COALESCE(a.total, 0)) ORDER BY m.key)
      FROM months m LEFT JOIN admissions a ON a.key = m.key
    ),
    'dismissals_by_month', (
      SELECT jsonb_agg(jsonb_build_object('key', m.key, 'count', COALESCE(d.total, 0)) ORDER BY m.key)
      FROM months m LEFT JOIN dismissals d ON d.key = m.key
    )
  )
  INTO v_result
  FROM totals t;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_turnover_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today    date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_year_ago date := ((now() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '1 year')::date;
  v_result   jsonb;
BEGIN
  WITH dismissed AS (
    SELECT e.id, e.name, e.dismissed_at, e.observation
    FROM employees e
    WHERE e.status = 'Desligado'
      AND e.dismissed_at IS NOT NULL
      AND EXTRACT(YEAR FROM e.dismissed_at) BETWEEN 1950 AND 2030
      AND e.dismissed_at::date >= v_year_ago
      AND e.dismissed_at::date <= v_today
  ),
  hired AS (
    SELECT count(*) AS total
    FROM employees e
    WHERE e.admission_date IS NOT NULL
      AND EXTRACT(YEAR FROM e.admission_date) BETWEEN 1950 AND 2030
      AND e.admission_date >= v_year_ago
      AND e.admission_date <= v_today
  ),
  active AS (
    SELECT count(*) AS total
    FROM employees e
    WHERE e.status IN ('Ativo', 'Férias', 'Afastado')
  )
  SELECT jsonb_build_object(
    'total', a.total + (SELECT count(*) FROM dismissed),
    'desligados', (SELECT count(*) FROM dismissed),
    -- Turnover = ((admissões + demissões) / 2) / headcount * 100
    'turnover', CASE
      WHEN a.total + (SELECT count(*) FROM dismissed) > 0
      THEN round(
        ((h.total + (SELECT count(*) FROM dismissed))::numeric / 2)
        / (a.total + (SELECT count(*) FROM dismissed)) * 100,
        1
      )
      ELSE 0
    END,
    'history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', d.id, 'name', d.name, 'dismissed_at', d.dismissed_at, 'observation', d.observation
      ) ORDER BY d.dismissed_at DESC)
      FROM dismissed d
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM active a, hired h;

  RETURN v_result;
END;
$$;

ALTER FUNCTION public.get_recruitment_metrics() OWNER TO postgres;
ALTER FUNCTION public.get_turnover_metrics() OWNER TO postgres;

GRANT ALL ON FUNCTION public.get_recruitment_metrics() TO anon;
GRANT ALL ON FUNCTION public.get_recruitment_metrics() TO authenticated;
GRANT ALL ON FUNCTION public.get_recruitment_metrics() TO service_role;

GRANT ALL ON FUNCTION public.get_turnover_metrics() TO anon;
GRANT ALL ON FUNCTION public.get_turnover_metrics() TO authenticated;
GRANT ALL ON FUNCTION public.get_turnover_metrics() TO service_role;
