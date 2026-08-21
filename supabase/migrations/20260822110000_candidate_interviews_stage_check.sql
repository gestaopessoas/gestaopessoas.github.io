-- Issue #41: `stage` era text puro, então qualquer grafia entrava no banco.
-- A lista espelha STAGE_OPTIONS de central-candidato/lib/candidateLogic.mjs.
-- NOT VALID de propósito: vale para toda gravação nova sem quebrar o deploy por causa
-- de registro legado fora da lista (validar depois com VALIDATE CONSTRAINT).

alter table public.candidate_interviews
  drop constraint if exists candidate_interviews_stage_check;

alter table public.candidate_interviews
  add constraint candidate_interviews_stage_check check (
    stage is null or stage in (
      'Triagem',
      'Entrevista RH',
      'Entrevista Gestor',
      'Testagem Psicológica',
      'Em entrevista',
      'Encaminhado - Pool Geral',
      'Encaminhado - Obra Específica',
      'Processo de MPs',
      'Aguardando Obra',
      'Em Avaliação na Obra',
      'Em Obra',
      'Proposta Pendente',
      'Proposta em Aprovação RH',
      'Proposta Aprovada',
      'Proposta',
      'Em proposta',
      'Coleta de Documentos & Exames',
      'Coleta de documentos',
      'Aguardando ASO',
      'Contratado',
      'Reprovado',
      'Desistente',
      'Banco de Talentos',
      'Recusado pela Obra',
      'Outros'
    )
  ) not valid;
