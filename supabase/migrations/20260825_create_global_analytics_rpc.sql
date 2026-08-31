-- ROLLBACK: DROP FUNCTION IF EXISTS public.get_global_analytics_data(integer, integer);
--
-- Global analytics/financeiro RPC.
-- Returns one row per employee for the requested month/year with dynamic cost
-- estimates (no snapshots).
--
-- Assumptions documented in code comments where the schema does not provide
-- an explicit monthly boundary or value.

CREATE OR REPLACE FUNCTION public.get_global_analytics_data(
  p_month integer,
  p_year integer
)
RETURNS TABLE (
  employee_id uuid,
  name text,
  company_name text,
  department_name text,
  cost_center_name text,
  base_salary numeric,
  variable_salary numeric,
  commission numeric,
  encargos numeric,
  benefit_seguro numeric,
  benefit_odonto numeric,
  benefit_vr numeric,
  benefit_va numeric,
  uniform_count bigint,
  uniform_cost numeric,
  absence_days bigint,
  absence_cost numeric,
  termination_estimate numeric
)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH month_bounds AS (
    SELECT
      MAKE_DATE(p_year, p_month, 1) AS start_date,
      (MAKE_DATE(p_year, p_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::date AS end_date
  ),
  benefit_sums AS (
    SELECT
      eb.employee_id,
      COALESCE(SUM(CASE WHEN eb.benefit_name ILIKE '%Seguro%' THEN eb.value ELSE 0 END), 0) AS seguro,
      COALESCE(SUM(CASE WHEN eb.benefit_name ILIKE '%Odonto%' THEN eb.value ELSE 0 END), 0) AS odonto,
      COALESCE(SUM(CASE WHEN eb.benefit_name ILIKE '%VALE REFEI%' OR eb.benefit_name ILIKE '%VR%' THEN eb.value ELSE 0 END), 0) AS vr,
      COALESCE(SUM(CASE WHEN eb.benefit_name ILIKE '%CESTA%' OR eb.benefit_name ILIKE '%Alimenta%' THEN eb.value ELSE 0 END), 0) AS va
    FROM employee_benefits eb
    WHERE eb.active = true
    -- employee_benefits has no month/year columns; active benefits are treated
    -- as current-month recurring costs (same pattern used by get_employee_financials).
    GROUP BY eb.employee_id
  ),
  uniform_sums AS (
    SELECT
      eu.employee_id,
      COALESCE(SUM(eu.quantity_delivered), 0)::bigint AS qty
    FROM employee_uniforms eu
    WHERE (DATE_TRUNC('month', eu.delivered_at AT TIME ZONE 'UTC'))::date = MAKE_DATE(p_year, p_month, 1)
    GROUP BY eu.employee_id
  ),
  absence_sums AS (
    SELECT
      tl.employee_id,
      COUNT(*)::bigint AS absence_days
    FROM time_logs tl
    WHERE tl.log_date >= (SELECT start_date FROM month_bounds)
      AND tl.log_date <= (SELECT end_date FROM month_bounds)
      -- A logged day with no clock-in/out records is interpreted as an absence.
      AND tl.entry_1 IS NULL
      AND tl.exit_1 IS NULL
      AND tl.entry_2 IS NULL
      AND tl.exit_2 IS NULL
    GROUP BY tl.employee_id
  )
  SELECT
    e.id AS employee_id,
    e.name::text,
    c.trading_name::text AS company_name,
    d.name::text AS department_name,
    cc.name::text AS cost_center_name,
    COALESCE(e.base_salary, 0) AS base_salary,
    COALESCE(e.variable_salary, 0) AS variable_salary,
    COALESCE(e.commission, 0) AS commission,
    ROUND(
      COALESCE(e.base_salary, 0) *
      (
        CASE
          WHEN e.contract_type = 'Pro Labore' THEN COALESCE(c.tax_rate_prolabore, 0)
          ELSE COALESCE(c.tax_rate_clt, 0)
        END
      ) / 100,
      2
    ) AS encargos,
    COALESCE(bs.seguro, 0) AS benefit_seguro,
    COALESCE(bs.odonto, 0) AS benefit_odonto,
    COALESCE(bs.vr, 0) AS benefit_vr,
    COALESCE(bs.va, 0) AS benefit_va,
    COALESCE(us.qty, 0) AS uniform_count,
    0::numeric AS uniform_cost, -- schema has no unit price; employee_uniforms stores quantity only
    COALESCE(asu.absence_days, 0) AS absence_days,
    ROUND(COALESCE(asu.absence_days, 0) * (COALESCE(e.base_salary, 0) / 30), 2) AS absence_cost,
    CASE
      WHEN e.dismissed_at IS NOT NULL
           AND EXTRACT(MONTH FROM e.dismissed_at)::int = p_month
           AND EXTRACT(YEAR FROM e.dismissed_at)::int = p_year
      THEN ROUND(
        COALESCE(e.base_salary, 0) +
        (
          COALESCE(e.base_salary, 0) *
          (
            CASE
              WHEN e.contract_type = 'Pro Labore' THEN COALESCE(c.tax_rate_prolabore, 0)
              ELSE COALESCE(c.tax_rate_clt, 0)
            END
          ) / 100
        ),
        2
      )
      ELSE 0::numeric
    END AS termination_estimate
  FROM employees e
  LEFT JOIN companies c ON c.id = e.company_id
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN cost_centers cc ON cc.id = e.cost_center_id
  LEFT JOIN benefit_sums bs ON bs.employee_id = e.id
  LEFT JOIN uniform_sums us ON us.employee_id = e.id
  LEFT JOIN absence_sums asu ON asu.employee_id = e.id
  WHERE e.status IN ('Ativo', 'Férias', 'Afastado')
     OR (
       e.dismissed_at IS NOT NULL
       AND EXTRACT(MONTH FROM e.dismissed_at)::int = p_month
       AND EXTRACT(YEAR FROM e.dismissed_at)::int = p_year
     )
  ORDER BY e.name;
END;
$$;

ALTER FUNCTION public.get_global_analytics_data(integer, integer) OWNER TO postgres;

GRANT ALL ON FUNCTION public.get_global_analytics_data(integer, integer) TO anon;
GRANT ALL ON FUNCTION public.get_global_analytics_data(integer, integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_global_analytics_data(integer, integer) TO service_role;
