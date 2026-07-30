-- supabase/migrations/20260801000000_secure_system_settings.sql
DROP POLICY IF EXISTS "Enable read access for all users" ON system_settings;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON system_settings;
DROP POLICY IF EXISTS "Permitir leitura/escrita para todos os autenticados" ON system_settings;

CREATE POLICY "Apenas admin visualiza configs"
  ON system_settings
  FOR SELECT TO authenticated
  USING (can_access('configuracoes', 'view'));

CREATE POLICY "Apenas admin altera configs"
  ON system_settings
  FOR ALL TO authenticated
  USING (can_access('configuracoes', 'edit'))
  WITH CHECK (can_access('configuracoes', 'edit'));
