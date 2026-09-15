-- Excluir uma vaga nao pode mais apagar quem se candidatou a ela (issue #61).
--
-- Duas garantias, nesta ordem:
--   1. a candidatura sobrevive a exclusao da requisicao (SET NULL, como as outras duas
--      FKs que apontam para job_requests);
--   2. quem se candidata entra no Banco de Talentos no mesmo instante, entao mesmo que a
--      candidatura seja apagada por outro caminho a pessoa continua encontravel.
--
-- O Banco de Talentos nao e tabela: e a marcacao 'Banco de Talentos' em
-- candidates.search_tags, lida por resolveCandidateStatus (ADR 0010). Marcar no banco, e
-- nao na tela, cobre todos os caminhos de insercao — portal publico, dashboard, importacao.

ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_job_request_id_fkey;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_job_request_id_fkey
  FOREIGN KEY (job_request_id) REFERENCES public.job_requests(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.candidatura_marca_banco_de_talentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  -- Sem acento e sem caixa: a mesma etapa e gravada em tres telas com grafias diferentes
  -- ("Banco de talentos" x "Banco de Talentos"), e duas marcas na mesma pessoa virariam
  -- duas tags na busca.
  UPDATE public.candidates c
     SET search_tags = COALESCE(c.search_tags, ARRAY[]::text[]) || 'Banco de Talentos'::text
   WHERE c.id = NEW.candidate_id
     AND NOT EXISTS (
       SELECT 1 FROM unnest(COALESCE(c.search_tags, ARRAY[]::text[])) t
        WHERE lower(public.unaccent(t)) = 'banco de talentos'
     );
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS candidatura_marca_banco_de_talentos ON public.job_applications;
CREATE TRIGGER candidatura_marca_banco_de_talentos
  AFTER INSERT ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.candidatura_marca_banco_de_talentos();

-- Quem ja se candidatou antes desta migration.
UPDATE public.candidates c
   SET search_tags = COALESCE(c.search_tags, ARRAY[]::text[]) || 'Banco de Talentos'::text
 WHERE EXISTS (SELECT 1 FROM public.job_applications a WHERE a.candidate_id = c.id)
   AND NOT EXISTS (
     SELECT 1 FROM unnest(COALESCE(c.search_tags, ARRAY[]::text[])) t
      WHERE lower(public.unaccent(t)) = 'banco de talentos'
   );

COMMENT ON FUNCTION public.candidatura_marca_banco_de_talentos() IS
  'Candidatura cria talento: quem se inscreve numa vaga entra no Banco de Talentos e continua la mesmo que a vaga seja excluida (issue #61).';
