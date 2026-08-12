-- supabase/migrations/20260801000002_secure_employees_rls.sql

-- Essa policy estava causando o vazamento para todos os autenticados
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON employees;
DROP POLICY IF EXISTS "Permitir leitura/escrita para todos os autenticados" ON employees;
DROP POLICY IF EXISTS "Enable read access for all users" ON employees;

CREATE POLICY "Colaborador lê o próprio perfil"
  ON employees
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "RH e Gestores leem todos os perfis"
  ON employees
  FOR SELECT TO authenticated
  USING (can_access('colaboradores', 'view') OR can_access('gestao', 'view'));

CREATE POLICY "Apenas RH edita perfis"
  ON employees
  FOR ALL TO authenticated
  USING (can_access('colaboradores', 'edit'))
  WITH CHECK (can_access('colaboradores', 'edit'));
