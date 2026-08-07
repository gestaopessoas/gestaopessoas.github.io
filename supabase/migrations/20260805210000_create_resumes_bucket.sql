-- Feature: upload de currículo no formulário público de candidatura (carreiras/page.tsx).
-- Coluna candidates.resume_url existe desde 00002_ats_schema.sql, mas nunca teve bucket/policy.
-- Padrão de RLS de storage: anon só INSERT (write-only, sem list/read -> não pode ler
-- currículo de outro candidato), authenticated lê via can_access('central_candidato','view').

INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_upload_resumes" ON storage.objects;
DROP POLICY IF EXISTS "hr_read_resumes" ON storage.objects;

CREATE POLICY "anon_upload_resumes"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "hr_read_resumes"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'resumes' AND public.can_access('central_candidato'::text, 'view'::text));
