-- A Vaga escolhe quais das 13 Etapas usa (issue #49).
--
-- NAO e "etapa com nome livre". O nome continua vindo das 13 canonicas do ADR 0006, e o
-- `check` de `job_applications.status` -- validado na Fase 3 -- fica de pe, intacto. O que a
-- vaga escolhe e um SUBCONJUNTO: "esta vaga de pedreiro nao tem Testagem Psicologica".
--
-- A ordem nao e configuravel. Ela vem da ordem do funil em `src/lib/stages.ts`. Vaga que
-- pudesse reordenar poria "Contratado" antes de "Triagem", e nenhuma tela que pergunta
-- "que etapa vem depois" sobreviveria a isso.

ALTER TABLE public.job_requests
  ADD COLUMN IF NOT EXISTS stages text[];

COMMENT ON COLUMN public.job_requests.stages IS
  'Subconjunto ordenado das 13 Etapas canonicas que esta Vaga usa. NULL = usa as 13.';

-- `NULL` e o estado de toda vaga que ja existe: sem backfill, sem mudar comportamento de
-- ninguem. Quem le resolve o NULL com `jobStages()`, que devolve as 13.
ALTER TABLE public.job_requests
  ADD CONSTRAINT job_requests_stages_check CHECK (
    stages IS NULL
    OR (
      -- so nome que e Etapa; nada de "Teste Tecnico" entrando pela porta dos fundos
      stages <@ ARRAY[
        'Nova', 'Triagem', 'Entrevista RH', 'Entrevista Gestor', 'Testagem Psicológica',
        'Aguardando Obra', 'Em Avaliação na Obra', 'Em Obra', 'Proposta', 'Documentação',
        'Processo de MP', 'Contratado', 'Reprovado', 'Desistente'
      ]::text[]
      -- entrada e saidas sao obrigatorias: sem "Nova" a vaga nao recebe ninguem, e sem as
      -- Terminais o candidato fica preso no funil para sempre
      AND ARRAY['Nova', 'Contratado', 'Reprovado', 'Desistente']::text[] <@ stages
    )
  );

-- ponytail: sem check de item repetido -- a tela monta a lista com um filtro sobre as 13, entao
-- repetir e impossivel por construcao. Se algum dia outra coisa escrever nesta coluna, o jeito
-- e um check com `cardinality(stages) = cardinality(ARRAY(SELECT DISTINCT unnest(stages)))`,
-- que exige uma funcao IMMUTABLE porque CHECK nao aceita subquery.
