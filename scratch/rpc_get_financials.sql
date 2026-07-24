-- Drop previous versions if they exist
DROP FUNCTION IF EXISTS get_employee_financials(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_employee_financials(p_month INTEGER, p_year INTEGER)
RETURNS TABLE (
  employee_id UUID,
  name TEXT,
  registration_number TEXT,
  company_name TEXT,
  cost_center_name TEXT,
  base_salary NUMERIC(10,2),
  variable_salary NUMERIC(10,2),
  commission NUMERIC(10,2),
  encargos NUMERIC(10,2),
  alimentacao NUMERIC(10,2),
  vr NUMERIC(10,2),
  seguro NUMERIC(10,2),
  odonto NUMERIC(10,2),
  sulclinica NUMERIC(10,2),
  total NUMERIC(10,2),
  status TEXT
) AS $$
DECLARE
  v_snapshot_id UUID;
  v_status TEXT;
BEGIN
  -- Check if a snapshot exists for this month/year
  SELECT id, s.status INTO v_snapshot_id, v_status
  FROM financial_snapshots s
  WHERE s.month = p_month AND s.year = p_year;

  IF v_snapshot_id IS NOT NULL THEN
    -- Return data from snapshot
    RETURN QUERY
    SELECT 
      fsd.employee_id,
      e.name,
      e.registration_number,
      c.trading_name AS company_name,
      cc.name AS cost_center_name,
      fsd.base_salary,
      fsd.variable_salary,
      fsd.commission,
      fsd.encargos,
      fsd.alimentacao,
      fsd.vr,
      fsd.seguro,
      fsd.odonto,
      fsd.sulclinica,
      fsd.total,
      v_status AS status
    FROM financial_snapshot_details fsd
    JOIN employees e ON e.id = fsd.employee_id
    LEFT JOIN companies c ON c.id = e.company_id
    LEFT JOIN cost_centers cc ON cc.id = e.cost_center_id
    WHERE fsd.snapshot_id = v_snapshot_id
    ORDER BY e.name;
  ELSE
    -- Calculate dynamically
    RETURN QUERY
    SELECT 
      e.id AS employee_id,
      e.name,
      e.registration_number,
      c.trading_name AS company_name,
      cc.name AS cost_center_name,
      COALESCE(e.base_salary, 0) AS base_salary,
      COALESCE(e.variable_salary, 0) AS variable_salary,
      COALESCE(e.commission, 0) AS commission,
      -- Encargos: base_salary * (tax_rate / 100)
      ROUND(COALESCE(e.base_salary, 0) * (CASE WHEN e.contract_type = 'Pro Labore' THEN c.tax_rate_prolabore ELSE c.tax_rate_clt END) / 100, 2) AS encargos,
      -- Benefícios (summed up if multiple, but here we assume mapping)
      COALESCE(b_alim.cost, 0) AS alimentacao,
      COALESCE(b_vr.cost, 0) AS vr,
      COALESCE(b_seg.cost, 0) AS seguro,
      COALESCE(b_od.cost, 0) AS odonto,
      COALESCE(b_sul.cost, 0) AS sulclinica,
      -- Total
      (
        COALESCE(e.base_salary, 0) + 
        COALESCE(e.variable_salary, 0) + 
        COALESCE(e.commission, 0) + 
        ROUND(COALESCE(e.base_salary, 0) * (CASE WHEN e.contract_type = 'Pro Labore' THEN c.tax_rate_prolabore ELSE c.tax_rate_clt END) / 100, 2) +
        COALESCE(b_alim.cost, 0) + COALESCE(b_vr.cost, 0) + COALESCE(b_seg.cost, 0) + COALESCE(b_od.cost, 0) + COALESCE(b_sul.cost, 0)
      ) AS total,
      'Em Andamento'::TEXT AS status
    FROM employees e
    LEFT JOIN companies c ON c.id = e.company_id
    LEFT JOIN cost_centers cc ON cc.id = e.cost_center_id
    LEFT JOIN (
      SELECT eb.employee_id, SUM(b.cost) as cost FROM employee_benefits eb JOIN benefits b ON b.id = eb.benefit_id 
      WHERE b.name ILIKE '%Alimentação%' GROUP BY eb.employee_id
    ) b_alim ON b_alim.employee_id = e.id
    LEFT JOIN (
      SELECT eb.employee_id, SUM(b.cost) as cost FROM employee_benefits eb JOIN benefits b ON b.id = eb.benefit_id 
      WHERE b.name ILIKE '%VR%' OR b.name ILIKE '%Refeição%' GROUP BY eb.employee_id
    ) b_vr ON b_vr.employee_id = e.id
    LEFT JOIN (
      SELECT eb.employee_id, SUM(b.cost) as cost FROM employee_benefits eb JOIN benefits b ON b.id = eb.benefit_id 
      WHERE b.name ILIKE '%Seguro%' GROUP BY eb.employee_id
    ) b_seg ON b_seg.employee_id = e.id
    LEFT JOIN (
      SELECT eb.employee_id, SUM(b.cost) as cost FROM employee_benefits eb JOIN benefits b ON b.id = eb.benefit_id 
      WHERE b.name ILIKE '%Odonto%' GROUP BY eb.employee_id
    ) b_od ON b_od.employee_id = e.id
    LEFT JOIN (
      SELECT eb.employee_id, SUM(b.cost) as cost FROM employee_benefits eb JOIN benefits b ON b.id = eb.benefit_id 
      WHERE b.name ILIKE '%Sulclinica%' OR b.name ILIKE '%Unimed%' OR b.name ILIKE '%Saúde%' GROUP BY eb.employee_id
    ) b_sul ON b_sul.employee_id = e.id
    WHERE e.status IN ('Ativo', 'Férias', 'Afastado')
    ORDER BY e.name;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
