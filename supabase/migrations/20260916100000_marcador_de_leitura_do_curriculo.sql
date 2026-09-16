-- Fase 2 do eixo unico de Etapa (ADR 0006, issue #57): "Curriculo Visualizado" nunca foi Etapa.
--
-- `CandidateProfileModal.openResume()` gravava 'Curriculo Visualizado' em
-- `job_applications.status`, sobrescrevendo a posicao real do candidato no funil so porque
-- alguem abriu o PDF. Depois da Fase 1 esse UPDATE virou no-op (o trigger de traducao devolve
-- a Etapa anterior), entao o marcador de leitura precisa de coluna propria.
--
-- Timestamp e nao booleano: "quando foi lido" responde tambem "foi lido?", e custa o mesmo.

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS resume_viewed_at timestamp with time zone;

COMMENT ON COLUMN public.job_applications.resume_viewed_at IS
  'Quando o curriculo desta candidatura foi aberto pela primeira vez. Marcador de leitura, nao Etapa (ADR 0006).';
