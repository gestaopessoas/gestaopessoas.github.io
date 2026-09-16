-- Issue #105: `anon_upload_resumes` e `anon_upload_employee_photos` só checam `bucket_id`.
-- Qualquer visitante do portal público pode gravar objeto em qualquer caminho do bucket,
-- com qualquer nome, qualquer tipo e qualquer tamanho. O teto de 5 MB do currículo é
-- validação de client: some para quem chamar a API direto com a anon key, que é pública
-- por definição.
--
-- Três travas, todas no servidor:
--
-- 1. `file_size_limit` no bucket — o Storage rejeita antes de gravar, independente do client.
-- 2. `allowed_mime_types` no bucket — currículo é documento, foto é imagem. O client passou a
--    mandar `contentType` explícito (ApplicationDialog / enviar-foto), porque navegador às
--    vezes entrega `File.type` vazio e o Storage cairia em `application/octet-stream`.
-- 3. Primeiro segmento do caminho tem que ser UUID. É o que os dois formulários já fazem
--    (`<candidate_id>/<uuid>-arquivo.pdf` e `<employee_id>/<tipo>/<uuid>-foto.jpg`), então
--    não muda nada para quem usa a tela — mas fecha a gravação em caminho arbitrário.
--
-- O que isto NÃO resolve: rate limit. Continua possível encher o bucket em volume, só que
-- agora dentro de pastas UUID, com tipo e tamanho limitados. Rate limit no insert público
-- vale junto com o de `candidates` e ficou fora desta migration de propósito.

UPDATE storage.buckets
SET file_size_limit = 5242880, -- 5 MiB, o mesmo teto que o formulário já mostra ao candidato
    allowed_mime_types = ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
WHERE id = 'resumes';

UPDATE storage.buckets
SET file_size_limit = 15728640, -- 15 MiB: foto de celular passa fácil de 5 MB sem compressão
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
WHERE id = 'employee-photos';

-- Primeiro segmento do caminho tem que ser UUID.
DROP POLICY IF EXISTS "anon_upload_resumes" ON storage.objects;
CREATE POLICY "anon_upload_resumes"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

-- `authenticated` entra aqui pela mesma razão de 20260916170000: recrutador logado
-- conferindo o portal também se candidata, e barrá-lo não protegia nada — bastava deslogar.
DROP POLICY IF EXISTS "anon_upload_employee_photos" ON storage.objects;
CREATE POLICY "anon_upload_employee_photos"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'employee-photos'
    AND (storage.foldername(name))[1] ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );
