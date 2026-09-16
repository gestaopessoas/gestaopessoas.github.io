-- Issue #105 deixou de fora o rate limit: `candidates` e o bucket `resumes` continuavam
-- aceitando insert anônimo em volume ilimitado. Quem tem a anon key (pública por definição)
-- podia criar 100 mil fichas e 100 mil arquivos de 5 MB num loop.
--
-- O site é export estático no GitHub Pages: não existe servidor nosso para interceptar a
-- requisição. Então a trava mora no banco.
--
-- Mecânica: o formulário público deixa de inventar o próprio UUID e passa a pedir um
-- "ticket" ao banco (`new_application_ticket`). O ticket é o que vira o id do candidato e a
-- pasta do currículo. Emitir ticket é a única porta com contador por IP; tudo o que vem
-- depois (o insert em `candidates`, o upload no Storage) exige um ticket válido e recente.
-- Uma porta com contador em vez de três.
--
-- O IP vem de `request.headers`, que o PostgREST preenche com os cabeçalhos da requisição.
-- O Storage não passa por ali — por isso o gate do bucket é o ticket, não o IP.

CREATE TABLE IF NOT EXISTS public.public_application_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_application_tickets_ip_idx
  ON public.public_application_tickets (ip_hash, created_at DESC);

-- Sem policy nenhuma: a tabela só é alcançável pelas funções SECURITY DEFINER abaixo.
ALTER TABLE public.public_application_tickets ENABLE ROW LEVEL SECURITY;

-- Emite um ticket, no máximo 15 por IP por hora.
CREATE OR REPLACE FUNCTION public.new_application_ticket()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ip text;
  v_hash text;
  v_recent int;
  v_id uuid;
BEGIN
  -- x-forwarded-for chega como "cliente, proxy1, proxy2"; o primeiro salto é o visitante.
  v_ip := btrim(split_part(
    coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''),
    ',', 1));

  -- Guardar IP cru seria PII sem necessidade: o contador só precisa distinguir origens.
  -- O sal fixo evita que o hash isolado identifique alguém; as linhas somem em 24 h.
  v_hash := CASE WHEN v_ip = '' THEN NULL ELSE md5('ticket:' || v_ip) END;

  DELETE FROM public.public_application_tickets WHERE created_at < now() - interval '24 hours';

  -- ponytail: falha para o lado aberto. Sem IP no cabeçalho não dá para separar visitante de
  -- visitante, e contar todo mundo num balde só derrubaria o portal no primeiro pico. Teto
  -- conhecido: se o cabeçalho sumir, o contador vira no-op — o gate de ticket continua valendo,
  -- mas o volume deixa de ser limitado. Saída, se acontecer: contador por janela deslizante na
  -- própria tabela de tickets, global, com teto alto o bastante para não pegar pico legitimo.
  IF v_hash IS NOT NULL THEN
    SELECT count(*) INTO v_recent
      FROM public.public_application_tickets
     WHERE ip_hash = v_hash AND created_at > now() - interval '1 hour';

    IF v_recent >= 15 THEN
      RAISE EXCEPTION 'rate_limit: muitas candidaturas enviadas deste acesso. Tente de novo em uma hora.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.public_application_tickets (ip_hash) VALUES (v_hash) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.new_application_ticket() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.new_application_ticket() TO anon, authenticated;

-- Recebe texto, não uuid: o argumento vem do caminho do arquivo no Storage, que pode ser
-- qualquer coisa. Cast direto estouraria com 22P02 em vez de negar.
CREATE OR REPLACE FUNCTION public.is_valid_application_ticket(p_folder text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.public_application_tickets t
     WHERE t.id::text = lower(coalesce(p_folder, ''))
       AND t.created_at > now() - interval '6 hours'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_valid_application_ticket(text) TO anon, authenticated;

-- `/enviar-foto` não tem ticket: o colaborador chega por link com o próprio id. O gate é
-- existir como colaborador — id de colaborador é UUID, não se adivinha.
-- ponytail: sem contador por colaborador. Quem tiver um id válido ainda pode repetir envio;
-- se isso aparecer, o passo seguinte é contar objetos por pasta na última hora.
CREATE OR REPLACE FUNCTION public.is_employee_folder(p_folder text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees e WHERE e.id::text = lower(coalesce(p_folder, ''))
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_employee_folder(text) TO anon, authenticated;

-- `Allow public insert to candidates` era FOR INSERT WITH CHECK (true) sem cláusula TO:
-- valia para qualquer role, inclusive anon. Passa a exigir ticket.
-- O RH continua criando candidato pela ficha por `candidates_insert_hr`, que checa permissão
-- em central_candidato e não depende de ticket.
DROP POLICY IF EXISTS "Allow public insert to candidates" ON public.candidates;
DROP POLICY IF EXISTS "Public can insert candidates" ON public.candidates;
CREATE POLICY "Public can insert candidates"
  ON public.candidates FOR INSERT
  TO anon, authenticated
  WITH CHECK (public.is_valid_application_ticket(id::text));

-- Storage: o regex de UUID de 20260916200000 vira desnecessário — o ticket já é um UUID
-- emitido pelo banco, e agora tem que ser um que exista.
DROP POLICY IF EXISTS "anon_upload_resumes" ON storage.objects;
CREATE POLICY "anon_upload_resumes"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND public.is_valid_application_ticket((storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "anon_upload_employee_photos" ON storage.objects;
CREATE POLICY "anon_upload_employee_photos"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'employee-photos'
    AND public.is_employee_folder((storage.foldername(name))[1])
  );

-- Fora deste escopo, de propósito: `job_applications`, `candidate_educations`,
-- `candidate_experiences` e `candidate_languages` continuam com WITH CHECK (true). Todas
-- exigem um `candidate_id` que exista (FK), e id de candidato é UUID — o atacante teria que
-- acertar um. Gatear por ticket quebraria o reaproveitamento de cadastro (23505), onde a
-- candidatura é vinculada a um candidato antigo, que ticket nenhum cobre.
