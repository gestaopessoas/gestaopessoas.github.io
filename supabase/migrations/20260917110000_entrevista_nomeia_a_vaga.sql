-- Issue #111: `interviews.role` ("Cargo Alvo") vinha de `candidates.role_interest`, que e o
-- cargo de interesse do momento do cadastro — nao a Vaga da Candidatura em andamento. A
-- entrevista de ANALISTA DE PROJETOS aparecia como AUXILIAR TECNICO na coluna Cargo Alvo e,
-- pior, na mensagem que bloqueia o avanco de etapa, que existe justamente para o recrutador
-- reconhecer de qual processo se trata.
--
-- Por que no banco e nao na tela: sao varios caminhos de escrita em `interviews` (Entrevistas,
-- Central do Candidato) e nenhum garante nada — mesmo raciocinio do ADR 0003 e da Fase 1 do
-- ADR 0006.

CREATE OR REPLACE FUNCTION public.cargo_da_candidatura(p_candidate uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  -- Candidatura em andamento manda; sem nenhuma viva, vale a ultima que existiu. Candidatura
  -- Espontanea (sem Vaga) nao tem cargo para emprestar e fica de fora.
  SELECT COALESCE(NULLIF(btrim(jr.position_title), ''), NULLIF(btrim(jr.requested_role), ''))
    FROM public.job_applications ja
    JOIN public.job_requests jr ON jr.id = ja.job_request_id
   WHERE ja.candidate_id = p_candidate
   ORDER BY (ja.status IN ('Contratado','Reprovado','Desistente')), ja.created_at DESC
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.cargo_da_candidatura(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.interview_role_da_vaga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cargo text;
BEGIN
  IF NEW.candidate_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Entrevista salva nao tem o cargo reescrito: trocar a Vaga de uma entrevista gravada e
  -- decisao de quem edita (a tela pergunta se vira entrevista nova), nao efeito colateral.
  IF TG_OP = 'UPDATE' AND COALESCE(btrim(OLD.role), '') <> '' THEN
    RETURN NEW;
  END IF;

  v_cargo := public.cargo_da_candidatura(NEW.candidate_id);
  IF v_cargo IS NOT NULL THEN
    NEW.role := v_cargo;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.interview_role_da_vaga() FROM PUBLIC;

DROP TRIGGER IF EXISTS interview_role_da_vaga ON public.interviews;
CREATE TRIGGER interview_role_da_vaga
BEFORE INSERT OR UPDATE OF candidate_id, role ON public.interviews
FOR EACH ROW
EXECUTE FUNCTION public.interview_role_da_vaga();

-- Backfill do estrago ja gravado, so onde nao ha ambiguidade: candidato com UMA unica
-- Candidatura em Vaga. Quem passou por duas vagas diferentes tem entrevistas de processos
-- diferentes, e adivinhar qual e qual reescreveria historico.
UPDATE public.interviews i
   SET role = c.cargo
  FROM (
    SELECT ja.candidate_id,
           max(COALESCE(NULLIF(btrim(jr.position_title), ''), NULLIF(btrim(jr.requested_role), ''))) AS cargo,
           count(DISTINCT ja.job_request_id) AS vagas
      FROM public.job_applications ja
      JOIN public.job_requests jr ON jr.id = ja.job_request_id
     GROUP BY ja.candidate_id
  ) c
 WHERE i.candidate_id = c.candidate_id
   AND c.vagas = 1
   AND c.cargo IS NOT NULL
   AND COALESCE(btrim(i.role), '') IS DISTINCT FROM c.cargo;
