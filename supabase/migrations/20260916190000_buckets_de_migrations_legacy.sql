-- Issue #107: os buckets `resumes`, `payslips` e `partner_logos` nascem em
-- `supabase/migrations_legacy/`, pasta que o CLI não aplica. Em produção eles existem
-- (foram criados quando aquela pasta ainda era a pasta oficial); no banco local, não.
-- Resultado: `/carreiras` e `/enviar-foto` só dava para testar contra produção, ou seja,
-- gravando candidato de verdade para conferir mudança de formulário.
--
-- Esta migration traz só os buckets e suas policies para a pasta viva. Não traz o resto de
-- `migrations_legacy`: o schema daquela pasta já está inteiro dentro de
-- `00000000000000_baseline_producao.sql`, que é o dump da produção. Bucket ficou de fora do
-- baseline porque `storage.buckets` é dado, não schema.
--
-- Em produção é no-op: `ON CONFLICT DO NOTHING` nos buckets, e as policies são recriadas
-- idênticas ao que `migrations_legacy` já tinha aplicado lá.

INSERT INTO storage.buckets (id, name, public) VALUES
  ('resumes', 'resumes', false),
  ('payslips', 'payslips', false),
  ('partner_logos', 'partner_logos', true)
ON CONFLICT (id) DO NOTHING;

-- resumes: anon só escreve (write-only, sem SELECT/list — não dá para ler currículo alheio),
-- e o RH lê pelo signed URL em CandidateProfileModal.
DROP POLICY IF EXISTS "anon_upload_resumes" ON storage.objects;
DROP POLICY IF EXISTS "hr_read_resumes" ON storage.objects;

CREATE POLICY "anon_upload_resumes"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "hr_read_resumes"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'resumes' AND public.can_access('central_candidato'::text, 'view'::text));

-- partner_logos é público de leitura (logo aparece no portal de descontos) e só autenticado
-- escreve.
DROP POLICY IF EXISTS "Logos de parceiros são públicas" ON storage.objects;
DROP POLICY IF EXISTS "Apenas autenticados podem fazer upload de logos" ON storage.objects;
DROP POLICY IF EXISTS "Apenas autenticados podem atualizar logos" ON storage.objects;
DROP POLICY IF EXISTS "Apenas autenticados podem excluir logos" ON storage.objects;

CREATE POLICY "Logos de parceiros são públicas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'partner_logos');

CREATE POLICY "Apenas autenticados podem fazer upload de logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'partner_logos');

CREATE POLICY "Apenas autenticados podem atualizar logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'partner_logos');

CREATE POLICY "Apenas autenticados podem excluir logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'partner_logos');

-- payslips fica sem policy de propósito, igual à produção: o holerite é lido pelo RH com a
-- service role, e a policy que isolaria por dono nunca foi escrita (está comentada em
-- migrations_legacy/20260714201000). Sem policy, RLS nega tudo para anon e authenticated —
-- é o estado seguro, e mudá-lo é decisão de outra issue.
