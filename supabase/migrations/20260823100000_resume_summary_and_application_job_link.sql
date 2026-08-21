-- 1. Resumo do currículo extraído na candidatura pública.
-- Colunas simples em `candidates`: as policies existentes da tabela já cobrem
-- (anon só INSERT, leitura por permissão), então não é preciso policy nova.
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS professional_summary text;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS experience_summary text;

-- 2. Vínculo candidatura ↔ vaga.
-- A candidatura pública só sabe o `job_opening_id`; toda listagem por vaga filtra
-- por `job_request_id`. Preencher no banco (e não no cliente) resolve para qualquer
-- origem de insert e não depende de o anon poder ler `job_openings`.
CREATE OR REPLACE FUNCTION public.job_applications_fill_job_request_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.job_request_id IS NULL AND NEW.job_opening_id IS NOT NULL THEN
    SELECT jo.job_request_id INTO NEW.job_request_id
    FROM public.job_openings jo
    WHERE jo.id = NEW.job_opening_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.job_applications_fill_job_request_id() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_job_applications_fill_job_request_id ON public.job_applications;
CREATE TRIGGER trg_job_applications_fill_job_request_id
BEFORE INSERT OR UPDATE OF job_opening_id ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.job_applications_fill_job_request_id();

-- 3. Backfill das candidaturas já gravadas sem `job_request_id`.
UPDATE public.job_applications ja
SET job_request_id = jo.job_request_id
FROM public.job_openings jo
WHERE ja.job_opening_id = jo.id
  AND ja.job_request_id IS NULL
  AND jo.job_request_id IS NOT NULL;
