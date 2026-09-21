-- A data do exame admissional entra na Candidatura (ADR 0011).
--
-- O pedido era "ASO marcado" como Etapa. Etapa nova foi rejeitada: `ASO Recebido` seria uma
-- segunda cópia do documento que já está em `candidate_documents`, e `ASO Marcado` não tem
-- onde guardar a única informação que importa -- para QUANDO está marcado. O ADR 0011 tem o
-- raciocínio completo.
--
-- Uma coluna, então, e os três grupos da tela de Admissão saem de leitura:
--   sem data                      -> Coleta de documentação
--   com data, documento ausente   -> ASO marcado
--   documento entregue            -> ASO recebido
--
-- `date` e não `timestamptz`: o RH marca o dia na clínica. A hora não muda nada do que a
-- tela mostra, e coluna que ninguém preenche direito é pior que coluna que não existe.
--
-- Na Candidatura e não no Candidato: o exame é da admissão daquela Candidatura. Quem fez
-- ASO para uma Obra e foi recontratado por outra faz outro.

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS aso_scheduled_at date;

COMMENT ON COLUMN public.job_applications.aso_scheduled_at IS
  'Data marcada do exame admissional (ASO). NULL = ainda não marcado. Ter a data não '
  'significa que o ASO chegou -- isso é o documento "ASO admissional" em candidate_documents '
  '(ADR 0011).';

-- Sem índice: a tela de Admissão já filtra por `status` (duas Etapas de umas quatorze) e lê
-- a data das linhas que sobraram. Índice aqui varreria menos do que o filtro que já existe.

-- Nenhum backfill. Candidatura em Documentação hoje não tem exame marcado que o banco
-- conheça, e inventar data é pior que deixar em branco: a tela trataria como marcado quem
-- ninguém marcou.
