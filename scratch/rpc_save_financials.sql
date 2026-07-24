CREATE OR REPLACE FUNCTION save_financial_snapshot(p_month INTEGER, p_year INTEGER, p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_snapshot_id UUID;
BEGIN
  -- Insert or update the snapshot record
  INSERT INTO financial_snapshots (month, year, created_by, status)
  VALUES (p_month, p_year, p_user_id, 'Fechado')
  ON CONFLICT (month, year) DO UPDATE SET status = 'Fechado', created_at = NOW(), created_by = p_user_id
  RETURNING id INTO v_snapshot_id;

  -- Delete existing details for this snapshot if overwriting
  DELETE FROM financial_snapshot_details WHERE snapshot_id = v_snapshot_id;

  -- Insert calculated details
  INSERT INTO financial_snapshot_details (
    snapshot_id, employee_id, base_salary, variable_salary, commission, encargos, alimentacao, vr, seguro, odonto, sulclinica, total
  )
  SELECT 
    v_snapshot_id,
    e.id AS employee_id,
    COALESCE(e.base_salary, 0) AS base_salary,
    COALESCE(e.variable_salary, 0) AS variable_salary,
    COALESCE(e.commission, 0) AS commission,
    ROUND(COALESCE(e.base_salary, 0) * (CASE WHEN e.contract_type = 'Pro Labore' THEN c.tax_rate_prolabore ELSE c.tax_rate_clt END) / 100, 2) AS encargos,
    COALESCE(b_alim.cost, 0) AS alimentacao,
    COALESCE(b_vr.cost, 0) AS vr,
    COALESCE(b_seg.cost, 0) AS seguro,
    COALESCE(b_od.cost, 0) AS odonto,
    COALESCE(b_sul.cost, 0) AS sulclinica,
    (
      COALESCE(e.base_salary, 0) + 
      COALESCE(e.variable_salary, 0) + 
      COALESCE(e.commission, 0) + 
      ROUND(COALESCE(e.base_salary, 0) * (CASE WHEN e.contract_type = 'Pro Labore' THEN c.tax_rate_prolabore ELSE c.tax_rate_clt END) / 100, 2) +
      COALESCE(b_alim.cost, 0) + COALESCE(b_vr.cost, 0) + COALESCE(b_seg.cost, 0) + COALESCE(b_od.cost, 0) + COALESCE(b_sul.cost, 0)
    ) AS total
  FROM employees e
  LEFT JOIN companies c ON c.id = e.company_id
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
  WHERE e.status IN ('Ativo', 'Férias', 'Afastado');

  RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
