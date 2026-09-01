-- Issue #46: link público para fotos de aniversário e admissão.
-- Opção B da spec (docs/specs/2026-08-31-triagem-issues-abertas.md): mesmo padrão do bucket
-- "resumes" (anon INSERT-only, sem SELECT/list -> não enumera fotos de outros colaboradores),
-- mas com o caminho prefixado por employee_id/purpose em vez de um UUID isolado, para o RH
-- conseguir listar as fotos de um colaborador sem precisar de tabela auxiliar.

INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-photos', 'employee-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_upload_employee_photos" ON storage.objects;
DROP POLICY IF EXISTS "hr_read_employee_photos" ON storage.objects;

CREATE POLICY "anon_upload_employee_photos"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'employee-photos');

CREATE POLICY "hr_read_employee_photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'employee-photos' AND public.can_access('colaboradores'::text, 'view'::text));
