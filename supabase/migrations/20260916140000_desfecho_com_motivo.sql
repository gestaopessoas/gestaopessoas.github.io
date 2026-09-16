-- Desfecho com motivo (issue: "Avançar não é o único caminho").
--
-- Não existe "encerrar processo" como conceito: quem não avança volta para o Banco de
-- Talentos, que é consulta derivada (ADR 0006). O que existe é o DESFECHO da Candidatura --
-- Contratado, Reprovado ou Desistente -- e os dois últimos passam a exigir motivo.
--
-- O motivo mora na Candidatura, e não numa tag em `candidates.search_tags`: tag foi
-- justamente o que a migration 20260916120000 acabou de apagar, porque tag e Etapa
-- divergiam. O destaque de "reprovado" nas telas é derivado de `status` + `outcome_reason`,
-- sem campo novo para desincronizar.


-- ---------------------------------------------------------------------------------------
-- 1. O motivo do desfecho
-- ---------------------------------------------------------------------------------------
-- Duas colunas e não uma: `outcome_reason` é a lista fechada (serve para contar "quantos
-- saíram por expectativa salarial"), `outcome_details` é o texto livre do recrutador.
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS outcome_reason  text,
  ADD COLUMN IF NOT EXISTS outcome_details text;

COMMENT ON COLUMN public.job_applications.outcome_reason IS
  'Motivo do desfecho, da lista fechada de src/lib/outcomes.ts. Obrigatório em Reprovado e Desistente.';
COMMENT ON COLUMN public.job_applications.outcome_details IS
  'Complemento em texto livre do motivo. Obrigatório quando outcome_reason = ''Outro''.';

-- NOT VALID: o backfill da Fase 1 criou Candidaturas Reprovadas a partir do histórico, e
-- elas não têm motivo para informar -- inventar um seria pior do que deixar em branco.
ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_outcome_reason_check;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_outcome_reason_check CHECK (
    (status NOT IN ('Reprovado', 'Desistente') OR btrim(COALESCE(outcome_reason, '')) <> '')
    AND (outcome_reason IS DISTINCT FROM 'Outro' OR btrim(COALESCE(outcome_details, '')) <> '')
  ) NOT VALID;


-- ---------------------------------------------------------------------------------------
-- 2. O histórico carrega o motivo
-- ---------------------------------------------------------------------------------------
-- `job_applications_grava_historico` (Fase 1) já escreve uma linha a cada mudança de Etapa.
-- Ela passa a levar o motivo junto: `rejection_reason` é a coluna que a tela de histórico já
-- lê, e a nota ganha o texto livre. Sem isso o motivo existiria só na Candidatura e sumiria
-- da linha do tempo do candidato, que é onde o RH procura.
CREATE OR REPLACE FUNCTION public.job_applications_grava_historico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nota text;
BEGIN
  IF NEW.candidate_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_nota := 'Etapa alterada na candidatura';
  IF btrim(COALESCE(NEW.outcome_reason, '')) <> ''
     AND NEW.outcome_reason IS DISTINCT FROM OLD.outcome_reason THEN
    v_nota := v_nota || E'\n[Motivo] ' || NEW.outcome_reason;
    IF btrim(COALESCE(NEW.outcome_details, '')) <> '' THEN
      v_nota := v_nota || E'\n' || NEW.outcome_details;
    END IF;
  END IF;

  INSERT INTO public.candidate_interviews
    (candidate_id, job_application_id, stage, notes, rejection_reason, created_by_user_id)
  VALUES
    (NEW.candidate_id, NEW.id, NEW.status, v_nota,
     CASE WHEN NEW.status IN ('Reprovado', 'Desistente') THEN NEW.outcome_reason END,
     auth.uid());

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.job_applications_grava_historico() FROM PUBLIC, anon, authenticated;

-- O motivo pode ser gravado no mesmo UPDATE que muda a Etapa, mas também depois (correção);
-- nos dois casos a linha de histórico precisa sair.
DROP TRIGGER IF EXISTS trg_job_applications_grava_historico ON public.job_applications;
CREATE TRIGGER trg_job_applications_grava_historico
AFTER UPDATE OF status, outcome_reason ON public.job_applications
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status OR NEW.outcome_reason IS DISTINCT FROM OLD.outcome_reason)
EXECUTE FUNCTION public.job_applications_grava_historico();


-- ---------------------------------------------------------------------------------------
-- 3. O check de `candidate_interviews.stage` aceita as 13 Etapas canônicas
-- ---------------------------------------------------------------------------------------
-- A lista de 20260822110000 espelhava o vocabulário velho: 'Nova', 'Documentação' e
-- 'Processo de MP' (singular) ficaram de fora. O trigger da seção 2 grava NEW.status, que é
-- canônico -- então avançar alguém para Documentação estouraria o check.
ALTER TABLE public.candidate_interviews
  DROP CONSTRAINT IF EXISTS candidate_interviews_stage_check;

ALTER TABLE public.candidate_interviews
  ADD CONSTRAINT candidate_interviews_stage_check CHECK (
    stage IS NULL OR stage IN (
      -- As 13 canônicas (src/lib/stages.ts)
      'Nova',
      'Triagem',
      'Entrevista RH',
      'Entrevista Gestor',
      'Testagem Psicológica',
      'Aguardando Obra',
      'Em Avaliação na Obra',
      'Em Obra',
      'Proposta',
      'Documentação',
      'Processo de MP',
      'Contratado',
      'Reprovado',
      'Desistente',
      -- Vocabulário antigo ainda presente no histórico (append-only: não se reescreve)
      'Em entrevista',
      'Encaminhado - Pool Geral',
      'Encaminhado - Obra Específica',
      'Processo de MPs',
      'Proposta Pendente',
      'Proposta em Aprovação RH',
      'Proposta Aprovada',
      'Em proposta',
      'Coleta de Documentos & Exames',
      'Coleta de documentos',
      'Aguardando ASO',
      'Banco de Talentos',
      'Recusado pela Obra',
      'Outros'
    )
  ) NOT VALID;


-- ---------------------------------------------------------------------------------------
-- 4. Quem vai entrevistar
-- ---------------------------------------------------------------------------------------
-- `interviews` não tinha entrevistador: a Agenda mostrava o encontro sem dizer quem atende.
-- `candidate_interviews.interviewer_name` não serve -- ali o Avançar grava quem CLICOU, e
-- 20260915120000 já colocou o autor da edição em `interviews`. São três papéis distintos.
--
-- FK para `employees` e não texto livre: o seletor do AddInterviewModal já escolhe de lá
-- (lideranças da obra + RH), e nome em texto livre é a fonte de verdade duplicada de sempre.
-- ON DELETE SET NULL: desligar o coordenador não pode apagar a entrevista.
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS interviewer_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.interviews.interviewer_id IS
  'Quem vai conduzir a entrevista (employees). Não confundir com o autor da edição (updated_by) nem com quem registrou a Etapa (candidate_interviews.interviewer_name).';

CREATE INDEX IF NOT EXISTS interviews_interviewer_id_idx
  ON public.interviews (interviewer_id)
  WHERE interviewer_id IS NOT NULL;


-- ---------------------------------------------------------------------------------------
-- 5. A Central do Candidato pode gravar o desfecho
-- ---------------------------------------------------------------------------------------
-- A Central é gateada pelo módulo `central_candidato`, que não estava na policy de UPDATE de
-- `job_applications` -- até agora ela só inseria histórico, nunca movia a Candidatura. Sem
-- isto, o botão de Reprovar levaria erro de RLS para quem tem a Central mas não Talentos.
DROP POLICY IF EXISTS job_applications_update_perm ON public.job_applications;

CREATE POLICY job_applications_update_perm ON public.job_applications
  FOR UPDATE
  USING (
    public.can_access('central_candidato', 'edit')
    OR public.can_access('talentos', 'edit')
    OR public.can_access('admissao', 'edit')
    OR public.can_access('vagas', 'edit')
  )
  WITH CHECK (
    public.can_access('central_candidato', 'edit')
    OR public.can_access('talentos', 'edit')
    OR public.can_access('admissao', 'edit')
    OR public.can_access('vagas', 'edit')
  );
