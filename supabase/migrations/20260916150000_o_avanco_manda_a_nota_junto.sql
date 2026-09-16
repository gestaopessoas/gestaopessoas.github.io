-- O avanço passa a mover a Etapa, e o histórico continua sendo escrito por uma mão só.
--
-- O problema: a Central escrevia a linha do histórico à mão e NUNCA atualizava
-- `job_applications.status`. Como a Etapa mora ali (ADR 0006), avançar não movia nada — a
-- lista continuava mostrando a etapa velha.
--
-- Fazer a tela atualizar a Candidatura resolve a Etapa e cria outro problema: o trigger de
-- histórico dispara e grava a linha dele, ao lado da linha rica da tela. Duas linhas por
-- clique.
--
-- A saída escolhida é a mesma que `outcome_reason` já usa: a tela manda o texto JUNTO com a
-- mudança de Etapa, e o trigger escreve UMA linha completa. A tela não escreve mais no
-- histórico, e não precisa procurar a linha que o trigger acabou de criar — procurar seria
-- uma corrida entre dois recrutadores salvando ao mesmo tempo, e o erro seria silencioso.


-- ---------------------------------------------------------------------------------------
-- 1. As colunas de recado
-- ---------------------------------------------------------------------------------------
-- Em repouso elas são SEMPRE NULL: o trigger consome e limpa na mesma instrução. Não são
-- dado da Candidatura, são o bilhete que viaja junto com o UPDATE. Se alguma linha aparecer
-- com valor aqui, é sinal de que o trigger deixou de rodar.
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS advance_notes           text,
  ADD COLUMN IF NOT EXISTS advance_candidate_future text;

COMMENT ON COLUMN public.job_applications.advance_notes IS
  'Transitório: a nota que o trigger de histórico grava na linha deste movimento. Consumida e zerada no mesmo UPDATE — sempre NULL em repouso.';
COMMENT ON COLUMN public.job_applications.advance_candidate_future IS
  'Transitório: o "futuro do candidato" da linha deste movimento. Consumido e zerado no mesmo UPDATE — sempre NULL em repouso.';


-- ---------------------------------------------------------------------------------------
-- 2. O trigger escreve a linha completa
-- ---------------------------------------------------------------------------------------
-- Vira BEFORE para poder zerar as colunas de recado no próprio NEW. Como AFTER, a limpeza
-- exigiria um segundo UPDATE na mesma tabela — que dispararia o trigger de novo.
--
-- `workplace_name` continua NULL de propósito (decisão da Fase 1): a Obra é da Vaga e se lê
-- por join. Gravar aqui recriaria a fonte de verdade em texto livre.
--
-- `interviewer_name` também não entra: ali a Central gravava quem CLICOU, e quem clicou já
-- vai em `created_by_user_id`. Quem vai ENTREVISTAR mora em `interviews.interviewer_id`.
CREATE OR REPLACE FUNCTION public.job_applications_grava_historico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nota text;
  v_mudou boolean;
BEGIN
  v_mudou := NEW.status IS DISTINCT FROM OLD.status
          OR NEW.outcome_reason IS DISTINCT FROM OLD.outcome_reason;

  -- Recado sem movimento não vira linha, mas também não pode ficar grudado na Candidatura:
  -- na próxima mudança de Etapa ele reapareceria como se fosse nota daquele movimento.
  IF NOT v_mudou OR NEW.candidate_id IS NULL THEN
    NEW.advance_notes := NULL;
    NEW.advance_candidate_future := NULL;
    RETURN NEW;
  END IF;

  v_nota := COALESCE(NULLIF(btrim(NEW.advance_notes), ''), 'Etapa alterada na candidatura');

  IF btrim(COALESCE(NEW.outcome_reason, '')) <> ''
     AND NEW.outcome_reason IS DISTINCT FROM OLD.outcome_reason THEN
    v_nota := v_nota || E'\n[Motivo] ' || NEW.outcome_reason;
    IF btrim(COALESCE(NEW.outcome_details, '')) <> '' THEN
      v_nota := v_nota || E'\n' || NEW.outcome_details;
    END IF;
  END IF;

  INSERT INTO public.candidate_interviews
    (candidate_id, job_application_id, stage, notes, rejection_reason, candidate_future, created_by_user_id)
  VALUES
    (NEW.candidate_id, NEW.id, NEW.status, v_nota,
     CASE WHEN NEW.status IN ('Reprovado', 'Desistente') THEN NEW.outcome_reason END,
     NULLIF(btrim(COALESCE(NEW.advance_candidate_future, '')), ''),
     auth.uid());

  NEW.advance_notes := NULL;
  NEW.advance_candidate_future := NULL;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.job_applications_grava_historico() FROM PUBLIC, anon, authenticated;

-- Numerado 4 para rodar depois das checagens (2 = Etapa Terminal, 3 = Exclusividade de
-- Obra): a ordem é alfabética, e não faz sentido montar a linha de um movimento que vai ser
-- recusado na instrução seguinte.
DROP TRIGGER IF EXISTS trg_job_applications_grava_historico ON public.job_applications;
DROP TRIGGER IF EXISTS trg_job_applications_4_grava_historico ON public.job_applications;
CREATE TRIGGER trg_job_applications_4_grava_historico
BEFORE UPDATE OF status, outcome_reason, advance_notes, advance_candidate_future
  ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.job_applications_grava_historico();

COMMENT ON FUNCTION public.job_applications_grava_historico() IS
  'Autor único do histórico de Etapa. A tela manda o texto pelas colunas advance_* no mesmo UPDATE, e esta função grava UMA linha completa e zera o recado.';


-- ---------------------------------------------------------------------------------------
-- 3. Check do comportamento
-- ---------------------------------------------------------------------------------------
-- Roda junto com a migration: se o recado deixar de ser consumido, ou se uma mudança de
-- Etapa passar a gerar duas linhas, a migration falha em vez de entregar histórico torto.
DO $check$
DECLARE
  v_cand uuid;
  v_app  uuid;
  n      int;
  sobra  int;
BEGIN
  INSERT INTO public.candidates (first_name, last_name, full_name, email)
  VALUES ('Check', 'Migration', 'Check Migration', 'check.20260916150000@exemplo.local')
  RETURNING id INTO v_cand;

  INSERT INTO public.job_applications (candidate_id, job_opening_id, status)
  VALUES (v_cand, public.publicacao_espontanea(NULL), 'Nova')
  RETURNING id INTO v_app;

  UPDATE public.job_applications
     SET status = 'Entrevista RH',
         advance_notes = '[Entrevista marcada] 20/09 as 09:00',
         advance_candidate_future = 'Perfil Técnico Forte'
   WHERE id = v_app;

  -- Uma linha por movimento, com a nota da tela e não o texto genérico.
  SELECT count(*) INTO n FROM public.candidate_interviews WHERE job_application_id = v_app;
  ASSERT n = 1, 'esperava 1 linha de historico, veio ' || n;

  ASSERT EXISTS (
    SELECT 1 FROM public.candidate_interviews
     WHERE job_application_id = v_app
       AND stage = 'Entrevista RH'
       AND notes = '[Entrevista marcada] 20/09 as 09:00'
       AND candidate_future = 'Perfil Técnico Forte'
  ), 'a linha nao recebeu a nota da tela';

  -- O recado foi consumido: em repouso as colunas sao NULL.
  SELECT count(*) INTO sobra FROM public.job_applications
   WHERE id = v_app AND (advance_notes IS NOT NULL OR advance_candidate_future IS NOT NULL);
  ASSERT sobra = 0, 'o recado ficou grudado na candidatura';

  -- Movimento sem recado volta ao texto generico, e continua sendo uma linha so.
  UPDATE public.job_applications SET status = 'Entrevista Gestor' WHERE id = v_app;
  ASSERT EXISTS (
    SELECT 1 FROM public.candidate_interviews
     WHERE job_application_id = v_app
       AND stage = 'Entrevista Gestor'
       AND notes = 'Etapa alterada na candidatura'
  ), 'movimento sem recado nao gravou o texto padrao';

  SELECT count(*) INTO n FROM public.candidate_interviews WHERE job_application_id = v_app;
  ASSERT n = 2, 'esperava 2 linhas apos dois movimentos, veio ' || n;

  DELETE FROM public.candidate_interviews WHERE job_application_id = v_app;
  DELETE FROM public.job_applications WHERE id = v_app;
  DELETE FROM public.candidates WHERE id = v_cand;
END
$check$;
