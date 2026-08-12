-- Fix RLS policies for benefit_ignores and benefit_audit_logs
-- These tables need INSERT and DELETE access for all users (anon role)

-- benefit_ignores
ALTER TABLE benefit_ignores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON benefit_ignores;
CREATE POLICY "Enable read access for all users" ON benefit_ignores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON benefit_ignores;
CREATE POLICY "Enable insert for all users" ON benefit_ignores FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable delete for all users" ON benefit_ignores;
CREATE POLICY "Enable delete for all users" ON benefit_ignores FOR DELETE USING (true);

-- benefit_audit_logs
ALTER TABLE benefit_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON benefit_audit_logs;
CREATE POLICY "Enable read access for all users" ON benefit_audit_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON benefit_audit_logs;
CREATE POLICY "Enable insert for all users" ON benefit_audit_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable delete for all users" ON benefit_audit_logs;
CREATE POLICY "Enable delete for all users" ON benefit_audit_logs FOR DELETE USING (true);
