-- Fim da Fase 2 do eixo unico de Etapa (ADR 0006, issue #57).
--
-- A Exclusividade de Obra passou a ser verificada na Candidatura, com join ate
-- job_openings.workplace_id (trigger trg_job_applications_3_exclusividade_de_obra, Fase 1).
-- O trigger antigo comparava candidate_interviews.workplace_name em texto livre, contra a
-- lista de etapas do vocabulario velho ('Banco de Talentos', que deixou de ser Etapa).
--
-- Ele cai JUNTO com a Fase 2, e nao depois: enquanto valer, pode barrar gravacao que o modelo
-- novo permite -- por exemplo o historico escrito pelo proprio trigger da Fase 1, ou uma
-- entrevista espontanea numa obra diferente da ultima entrevista do candidato.
--
-- A regra de negocio nao morre aqui, so muda de lugar. Ela continua valendo, e agora sobre a
-- Candidatura, que e quem carrega a Obra.

DROP TRIGGER IF EXISTS trg_check_active_workplace_lock ON public.candidate_interviews;

DROP FUNCTION IF EXISTS public.check_active_workplace_lock();

-- Conferencia: se o trigger novo nao existir, a Exclusividade de Obra ficaria sem ninguem
-- vigiando. Falhar aqui e melhor do que descobrir isso com dois processos abertos em obras
-- diferentes.
DO $conferencia$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'trg_job_applications_3_exclusividade_de_obra'
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'A Exclusividade de Obra ficaria sem trigger: aplique a Fase 1 (20260915160000) antes desta migration.';
  END IF;
END
$conferencia$;
