-- Apagar a entrevista passa a apagar a Etapa que nasceu dela.
--
-- O problema: `interviews` e `candidate_interviews` nunca se conheceram. Excluir a entrevista
-- na tela de Entrevistas deixava a linha da Etapa intacta na Central — sem nenhuma entrevista
-- por trás, e sem como saber disso.
--
-- Por que não dá para ligar as duas por join: a Etapa é escrita por trigger de
-- `job_applications`, e a entrevista é criada pela tela num segundo statement. Nada hoje diz
-- QUAL entrevista corresponde a QUAL linha do histórico. Candidato com duas entrevistas no
-- mesmo dia não tem par determinável.
--
-- ponytail: o elo vale só daqui pra frente. As linhas que já existem ficam com
-- `interview_id` NULL e não são tocadas — parear o passado exigiria adivinhar por data, e um
-- par errado apaga o histórico errado no primeiro DELETE. NULL nunca cascateia, então o
-- histórico antigo sobrevive a qualquer exclusão, que é o comportamento de hoje.


-- ---------------------------------------------------------------------------------------
-- 1. O elo
-- ---------------------------------------------------------------------------------------
ALTER TABLE public.candidate_interviews
  ADD COLUMN IF NOT EXISTS interview_id uuid;

-- Idempotente na mão: ADD CONSTRAINT não aceita IF NOT EXISTS nesta versão do Postgres, e a
-- migration precisa poder rodar de novo sobre um banco que já a recebeu.
DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'candidate_interviews_interview_id_fkey'
       AND conrelid = 'public.candidate_interviews'::regclass
  ) THEN
    ALTER TABLE public.candidate_interviews
      ADD CONSTRAINT candidate_interviews_interview_id_fkey
      FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE CASCADE;
  END IF;
END
$fk$;

-- Sem índice, cada DELETE em `interviews` varre `candidate_interviews` inteira para achar o
-- que cascatear. O índice é o que mantém a exclusão barata conforme o histórico cresce.
CREATE INDEX IF NOT EXISTS candidate_interviews_interview_id_idx
  ON public.candidate_interviews (interview_id)
  WHERE interview_id IS NOT NULL;

COMMENT ON COLUMN public.candidate_interviews.interview_id IS
  'A entrevista que originou esta linha da Etapa, quando houve uma. ON DELETE CASCADE: excluir a entrevista apaga o registro dela no histórico. NULL nas Etapas que não vêm de entrevista (Nova, Proposta, Documentação) e em tudo que é anterior a esta migration.';


-- ---------------------------------------------------------------------------------------
-- 2. Mais uma coluna de recado
-- ---------------------------------------------------------------------------------------
-- Mesmo mecanismo de `advance_notes`: a tela manda o id junto com a mudança de Etapa e o
-- trigger consome. Em repouso é SEMPRE NULL — valor sobrando aqui significa trigger que
-- deixou de rodar.
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS advance_interview_id uuid;

COMMENT ON COLUMN public.job_applications.advance_interview_id IS
  'Transitório: a entrevista que originou este movimento. Consumida e zerada no mesmo UPDATE — sempre NULL em repouso.';


-- ---------------------------------------------------------------------------------------
-- 3. O trigger grava o elo
-- ---------------------------------------------------------------------------------------
-- Continua sendo o autor único do histórico. A única mudança é carregar o id do recado para
-- a coluna nova e zerar o recado junto com os outros.
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
    NEW.advance_interview_id := NULL;
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
    (candidate_id, job_application_id, stage, notes, rejection_reason, candidate_future, created_by_user_id, interview_id)
  VALUES
    (NEW.candidate_id, NEW.id, NEW.status, v_nota,
     CASE WHEN NEW.status IN ('Reprovado', 'Desistente') THEN NEW.outcome_reason END,
     NULLIF(btrim(COALESCE(NEW.advance_candidate_future, '')), ''),
     auth.uid(),
     NEW.advance_interview_id);

  NEW.advance_notes := NULL;
  NEW.advance_candidate_future := NULL;
  NEW.advance_interview_id := NULL;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.job_applications_grava_historico() FROM PUBLIC, anon, authenticated;

-- O trigger é recriado só para incluir `advance_interview_id` na lista de colunas vigiadas:
-- sem isso, um UPDATE que mandasse apenas o id não acordaria a função. Numeração 4 mantida.
DROP TRIGGER IF EXISTS trg_job_applications_4_grava_historico ON public.job_applications;
CREATE TRIGGER trg_job_applications_4_grava_historico
BEFORE UPDATE OF status, outcome_reason, advance_notes, advance_candidate_future, advance_interview_id
  ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.job_applications_grava_historico();


-- ---------------------------------------------------------------------------------------
-- 4. Check do comportamento
-- ---------------------------------------------------------------------------------------
-- Prova as duas metades que importam: a Etapa que veio de entrevista some junto com ela, e a
-- Etapa que não veio de nenhuma sobrevive. A segunda é o que protege o histórico antigo.
DO $check$
DECLARE
  v_cand uuid;
  v_app  uuid;
  v_entrevista uuid;
  n int;
  sobra int;
BEGIN
  INSERT INTO public.candidates (first_name, last_name, full_name, email)
  VALUES ('Check', 'Cascade', 'Check Cascade', 'check.20260918120000@exemplo.local')
  RETURNING id INTO v_cand;

  INSERT INTO public.job_applications (candidate_id, job_opening_id, status)
  VALUES (v_cand, public.publicacao_espontanea(NULL), 'Nova')
  RETURNING id INTO v_app;

  -- O nascimento da candidatura é uma Etapa SEM entrevista: tem de ficar de pé até o fim.
  SELECT count(*) INTO n
    FROM public.candidate_interviews
   WHERE job_application_id = v_app AND interview_id IS NULL;
  ASSERT n >= 1, 'esperava ao menos uma linha sem entrevista, veio ' || n;

  INSERT INTO public.interviews (candidate_id, candidate_name, interview_date, status, result)
  VALUES (v_cand, 'Check Cascade', current_date, 'Aguardando', 'N/C')
  RETURNING id INTO v_entrevista;

  UPDATE public.job_applications
     SET status = 'Entrevista RH',
         advance_notes = '[Entrevista marcada] 20/09 as 09:00',
         advance_interview_id = v_entrevista
   WHERE id = v_app;

  -- A linha do movimento nasceu amarrada à entrevista.
  SELECT count(*) INTO n
    FROM public.candidate_interviews
   WHERE job_application_id = v_app AND interview_id = v_entrevista;
  ASSERT n = 1, 'esperava 1 linha amarrada a entrevista, veio ' || n;

  -- O recado foi consumido.
  SELECT count(*) INTO sobra FROM public.job_applications
   WHERE id = v_app AND advance_interview_id IS NOT NULL;
  ASSERT sobra = 0, 'o id da entrevista ficou grudado na candidatura';

  -- O CASCADE: apagar a entrevista leva a linha dela junto.
  DELETE FROM public.interviews WHERE id = v_entrevista;

  SELECT count(*) INTO n
    FROM public.candidate_interviews
   WHERE job_application_id = v_app AND stage = 'Entrevista RH';
  ASSERT n = 0, 'a Etapa da entrevista apagada continua no historico';

  -- E o que nao veio de entrevista continua la: o historico antigo nao e colateral.
  SELECT count(*) INTO n
    FROM public.candidate_interviews
   WHERE job_application_id = v_app AND interview_id IS NULL;
  ASSERT n >= 1, 'o CASCADE levou junto uma Etapa que nao era de entrevista';

  DELETE FROM public.candidate_interviews WHERE job_application_id = v_app;
  DELETE FROM public.job_applications WHERE id = v_app;
  DELETE FROM public.candidates WHERE id = v_cand;
END
$check$;


-- Sem isto o PostgREST segue com o schema antigo em cache e recusa `advance_interview_id`
-- como coluna desconhecida — o avanço da tela quebraria até o próximo restart.
NOTIFY pgrst, 'reload schema';
