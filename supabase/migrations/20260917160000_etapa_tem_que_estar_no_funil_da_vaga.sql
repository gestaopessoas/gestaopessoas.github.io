-- A Etapa de uma Candidatura tem que existir no funil da Vaga dela (issue #128).
--
-- A #49 deu a cada Vaga um subconjunto das 14 Etapas (`job_requests.stages`), mas isso so
-- mudava o que a tela MOSTRAVA. Dava para configurar uma vaga sem "Testagem Psicologica" e
-- mover alguem para "Testagem Psicologica" mesmo assim -- o funil era documentacao de intencao,
-- nao regra.
--
-- A regra mora aqui, e nao nas telas, porque sao QUATRO lugares que escrevem
-- `job_applications.status`: Admissao, Portal do Gestor, Entrevistas e o avanco manual da
-- Central. Guarda em quatro telas sempre esquece a quinta.
--
-- Ocupa o slot `_1_`, vago desde que a Fase 3 derrubou `trg_job_applications_1_traduz_etapa`:
-- trigger dispara em ordem alfabetica, e validacao tem que correr antes de historico (`_4_`)
-- para nao registrar um movimento que sera recusado.

CREATE OR REPLACE FUNCTION public.job_applications_etapa_no_funil_da_vaga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stages text[];
BEGIN
  -- Candidatura Espontanea nao tem Vaga: nao ha funil contra o que validar.
  IF NEW.job_request_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT stages INTO v_stages FROM public.job_requests WHERE id = NEW.job_request_id;

  -- `NULL` = a vaga nao escolheu funil e usa as 14. O `check` estatico de `status` ja garante
  -- que o valor e uma das 14, entao nao ha o que checar aqui.
  IF v_stages IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT (NEW.status = ANY (v_stages)) THEN
    RAISE EXCEPTION
      'A Etapa "%" nao faz parte do funil desta vaga. O funil dela e: %.',
      NEW.status, array_to_string(v_stages, ', ')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.job_applications_etapa_no_funil_da_vaga() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_job_applications_1_etapa_no_funil ON public.job_applications;
CREATE TRIGGER trg_job_applications_1_etapa_no_funil
BEFORE INSERT OR UPDATE OF status ON public.job_applications
FOR EACH ROW
EXECUTE FUNCTION public.job_applications_etapa_no_funil_da_vaga();

-- NAO ha `VALIDATE` de linha existente, e nao e esquecimento: hoje nenhuma vaga tem funil
-- configurado (`stages` nasceu NULL em todas na #49), entao nao existe linha em violacao. O
-- estado ruim so nasceria se alguem removesse do funil uma Etapa que ja tem gente parada nela --
-- e e por isso que a tela de edicao da vaga passa a bloquear essa remocao. Sem aquela guarda,
-- esta excecao apareceria para o usuario no pior momento: ao tentar mover o candidato preso.
