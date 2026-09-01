-- Corrige "new row violates row-level security policy" ao enviar foto: a policy de INSERT
-- só liberava o papel "anon" (visitante não logado). Se quem testa o link /enviar-foto está
-- com sessão ativa no dashboard do RH no mesmo navegador, a requisição vai como
-- "authenticated" -- papel para o qual não havia nenhuma policy de INSERT nesse bucket.

DROP POLICY IF EXISTS "anon_upload_employee_photos" ON storage.objects;

CREATE POLICY "anon_upload_employee_photos"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'employee-photos');
