-- O nascimento da Candidatura passa a virar linha de histórico (issue #130).
--
-- `candidate_interviews` é a linha do tempo da Etapa (ADR 0006), mas o autor dela
-- (`trg_job_applications_4_grava_historico`) é BEFORE UPDATE — e Candidatura nasce por
-- INSERT. Resultado: a primeira Etapa nunca virava linha, e o candidato aparecia no
-- histórico só no segundo movimento, como se tivesse surgido no meio do funil.
--
-- Por que NÃO é a mesma função com o gatilho alargado, que era o desenho proposto na issue:
--
--   1. O `_4_` é BEFORE de propósito — ele zera as colunas de recado `advance_*` no próprio
--      NEW. Como AFTER, a limpeza exigiria um segundo UPDATE na mesma tabela.
--   2. E BEFORE INSERT não serve para o nascimento: a linha da Candidatura ainda não existe
--      na tabela, e `candidate_interviews.job_application_id` tem FK NÃO deferrable — o
--      INSERT do histórico estouraria violação de chave estrangeira.
--
-- Então o nascimento tem que ser AFTER INSERT, e AFTER INSERT não pode mexer em NEW. São
-- dois momentos diferentes do mesmo evento: trigger separado, no slot `_5_`.
--
-- Ordem alfabética continua valendo: `_1_` valida a Etapa contra o funil da Vaga (BEFORE
-- INSERT, issue #128). Se ele recusar, o INSERT inteiro morre e o `_5_` nunca roda — que é o
-- certo: não se registra o nascimento de uma Candidatura que não nasceu.
--
-- Sem backfill, por decisão do dono do projeto: as Candidaturas que já existem seguem sem a
-- linha de nascimento. O histórico registra nascimento de hoje em diante.

CREATE OR REPLACE FUNCTION public.job_applications_grava_nascimento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nota text;
BEGIN
  -- `candidate_interviews.candidate_id` é NOT NULL: sem candidato não há linha do tempo.
  IF NEW.candidate_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_nota := COALESCE(NULLIF(btrim(NEW.advance_notes), ''), 'Candidatura criada');

  INSERT INTO public.candidate_interviews
    (candidate_id, job_application_id, stage, notes, candidate_future, created_by_user_id)
  VALUES
    (NEW.candidate_id, NEW.id, NEW.status, v_nota,
     NULLIF(btrim(COALESCE(NEW.advance_candidate_future, '')), ''),
     auth.uid());

  -- O recado já virou linha; deixá-lo grudado faria ele reaparecer como nota do PRÓXIMO
  -- movimento. AFTER não pode mexer em NEW, então a limpeza é um UPDATE — que dispara o
  -- `_4_`, onde a Etapa não mudou: ele apenas zera o recado e não grava linha nenhuma.
  IF NEW.advance_notes IS NOT NULL OR NEW.advance_candidate_future IS NOT NULL THEN
    UPDATE public.job_applications
       SET advance_notes = NULL, advance_candidate_future = NULL
     WHERE id = NEW.id;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.job_applications_grava_nascimento() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_job_applications_5_grava_nascimento ON public.job_applications;
CREATE TRIGGER trg_job_applications_5_grava_nascimento
AFTER INSERT ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.job_applications_grava_nascimento();

COMMENT ON FUNCTION public.job_applications_grava_nascimento() IS
  'Grava a linha de nascimento da Candidatura no histórico de Etapa. Par AFTER INSERT do job_applications_grava_historico(), que cuida dos movimentos seguintes.';


-- ---------------------------------------------------------------------------------------
-- Check do comportamento
-- ---------------------------------------------------------------------------------------
DO $check$
DECLARE
  v_cand uuid;
  v_app  uuid;
  n      int;
  sobra  int;
BEGIN
  INSERT INTO public.candidates (first_name, last_name, full_name, email)
  VALUES ('Check', 'Nascimento', 'Check Nascimento', 'check.20260917170000@exemplo.local')
  RETURNING id INTO v_cand;

  -- Nasce com recado: a linha de nascimento leva o texto da tela.
  INSERT INTO public.job_applications (candidate_id, job_opening_id, status, advance_notes)
  VALUES (v_cand, public.publicacao_espontanea(NULL), 'Entrevista RH', '[Entrevista marcada] 20/09 as 09:00')
  RETURNING id INTO v_app;

  SELECT count(*) INTO n FROM public.candidate_interviews WHERE job_application_id = v_app;
  ASSERT n = 1, 'o nascimento nao virou linha, veio ' || n;

  ASSERT EXISTS (
    SELECT 1 FROM public.candidate_interviews
     WHERE job_application_id = v_app
       AND stage = 'Entrevista RH'
       AND notes = '[Entrevista marcada] 20/09 as 09:00'
  ), 'a linha de nascimento nao recebeu a Etapa/nota do INSERT';

  SELECT count(*) INTO sobra FROM public.job_applications
   WHERE id = v_app AND (advance_notes IS NOT NULL OR advance_candidate_future IS NOT NULL);
  ASSERT sobra = 0, 'o recado ficou grudado na candidatura';

  -- O movimento seguinte continua sendo UMA linha: os dois triggers nao se somam.
  UPDATE public.job_applications SET status = 'Entrevista Gestor' WHERE id = v_app;
  SELECT count(*) INTO n FROM public.candidate_interviews WHERE job_application_id = v_app;
  ASSERT n = 2, 'esperava 2 linhas (nascimento + 1 movimento), veio ' || n;

  DELETE FROM public.candidate_interviews WHERE job_application_id = v_app;
  DELETE FROM public.job_applications WHERE id = v_app;

  -- Nascimento sem recado usa o texto padrao.
  INSERT INTO public.job_applications (candidate_id, job_opening_id, status)
  VALUES (v_cand, public.publicacao_espontanea(NULL), 'Nova')
  RETURNING id INTO v_app;

  ASSERT EXISTS (
    SELECT 1 FROM public.candidate_interviews
     WHERE job_application_id = v_app AND stage = 'Nova' AND notes = 'Candidatura criada'
  ), 'nascimento sem recado nao gravou o texto padrao';

  DELETE FROM public.candidate_interviews WHERE job_application_id = v_app;
  DELETE FROM public.job_applications WHERE id = v_app;
  DELETE FROM public.candidates WHERE id = v_cand;
END
$check$;
