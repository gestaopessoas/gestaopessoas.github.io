-- supabase/migrations/20260801000001_secure_financials.sql

-- 1. Proteger as tabelas de fechamento
DROP POLICY IF EXISTS "Enable read access for all users" ON financial_snapshots;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON financial_snapshots;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON financial_snapshots;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON financial_snapshots;

CREATE POLICY "RH gerencia fechamentos" ON financial_snapshots
  FOR ALL TO authenticated
  USING (can_access('financeiro', 'edit'))
  WITH CHECK (can_access('financeiro', 'edit'));

DROP POLICY IF EXISTS "Enable read access for all users" ON financial_snapshot_details;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON financial_snapshot_details;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON financial_snapshot_details;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON financial_snapshot_details;

CREATE POLICY "RH gerencia detalhes do fechamento" ON financial_snapshot_details
  FOR ALL TO authenticated
  USING (can_access('financeiro', 'edit'))
  WITH CHECK (can_access('financeiro', 'edit'));

-- 2. Proteger a RPC get_employee_financials mudando para SECURITY INVOKER
-- Assim a função roda sob as regras de RLS do usuário logado (authenticated)
-- e não consegue mais bypassar as proteções das tabelas base.
ALTER FUNCTION get_employee_financials(integer, integer) SECURITY INVOKER;
