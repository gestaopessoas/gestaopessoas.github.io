-- 1. Add columns to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tax_rate_clt NUMERIC(5,2) DEFAULT 65.98;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tax_rate_prolabore NUMERIC(5,2) DEFAULT 20.00;

-- 2. Create financial_snapshots table
CREATE TABLE IF NOT EXISTS financial_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  status TEXT DEFAULT 'Fechado',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID, -- Can be linked to auth.users later
  UNIQUE(month, year)
);

-- 3. Create financial_snapshot_details table
CREATE TABLE IF NOT EXISTS financial_snapshot_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID REFERENCES financial_snapshots(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id),
  base_salary NUMERIC(10,2) DEFAULT 0,
  variable_salary NUMERIC(10,2) DEFAULT 0,
  commission NUMERIC(10,2) DEFAULT 0,
  encargos NUMERIC(10,2) DEFAULT 0,
  alimentacao NUMERIC(10,2) DEFAULT 0,
  vr NUMERIC(10,2) DEFAULT 0,
  seguro NUMERIC(10,2) DEFAULT 0,
  odonto NUMERIC(10,2) DEFAULT 0,
  sulclinica NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) DEFAULT 0,
  UNIQUE(snapshot_id, employee_id)
);

-- Note: In Supabase, if we want to enable RLS:
ALTER TABLE financial_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_snapshot_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to financial_snapshots" ON financial_snapshots FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated full access to financial_snapshot_details" ON financial_snapshot_details FOR ALL TO authenticated USING (true);
