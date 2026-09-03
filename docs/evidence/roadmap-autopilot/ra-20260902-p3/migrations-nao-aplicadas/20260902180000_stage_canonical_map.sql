-- Fase 1 do eixo unico de Etapa (docs/adr/0006, "Etapas canonicas"; issue #56).
--
-- Mapa explicito valor-a-valor dos cinco vocabularios antigos para a lista canonica.
-- NUNCA um default: `normalizeStage` em src/app/dashboard/vagas/lib/stages.ts joga tudo que
-- nao reconhece em 'Nova', e esse default silencioso e literalmente o bug que a epica existe
-- para matar. Aqui, valor desconhecido devolve NULL e quem chama decide o que fazer.
--
-- Uma funcao so porque sao dois consumidores com o mesmo mapa: o backfill desta fase e o
-- trigger BEFORE de traducao que segura as telas nao migradas ate a Fase 3. Duas copias do
-- CASE divergiriam na primeira correcao.
--
-- Devolve NULL de proposito para o que deixa de ser Etapa:
--   'Encaminhado - Obra Especifica' / 'Encaminhado - Pool Geral' -> viram Candidatura, nao Etapa
--   'Banco de Talentos'                                          -> vira consulta derivada
--   'Em entrevista' / 'Outros' / 'Curriculo Visualizado'         -> balde, ausencia, marcador

CREATE OR REPLACE FUNCTION public.canonical_stage(v_stage text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT CASE btrim(coalesce(v_stage, ''))

    -- ja canonicas (idempotente: rodar o mapa duas vezes nao muda nada)
    WHEN 'Nova'                       THEN 'Nova'
    WHEN 'Triagem'                    THEN 'Triagem'
    WHEN 'Entrevista RH'              THEN 'Entrevista RH'
    WHEN 'Entrevista Gestor'          THEN 'Entrevista Gestor'
    WHEN 'Testagem Psicológica'       THEN 'Testagem Psicológica'
    WHEN 'Aguardando Obra'            THEN 'Aguardando Obra'
    WHEN 'Em Avaliação na Obra'       THEN 'Em Avaliação na Obra'
    WHEN 'Em Obra'                    THEN 'Em Obra'
    WHEN 'Proposta'                   THEN 'Proposta'
    WHEN 'Documentação'               THEN 'Documentação'
    WHEN 'Processo de MP'             THEN 'Processo de MP'
    WHEN 'Contratado'                 THEN 'Contratado'
    WHEN 'Reprovado'                  THEN 'Reprovado'
    WHEN 'Desistente'                 THEN 'Desistente'

    -- entrada do funil
    WHEN 'Nova Aplicação'             THEN 'Nova'

    -- entrevistas: o Portal do Gestor le tres redacoes da mesma etapa
    WHEN 'Entrevista com Gestor'      THEN 'Entrevista Gestor'
    WHEN 'Entrevista com a Gestão'    THEN 'Entrevista Gestor'
    -- 'Entrevista' e a etapa generica de PIPELINE_STAGES, anterior a separacao RH/Gestor.
    -- Unico juizo do mapa: cai na primeira entrevista real, nao na do gestor.
    WHEN 'Entrevista'                 THEN 'Entrevista RH'

    -- proposta: quatro redacoes, nenhum codigo ramifica por elas
    WHEN 'Proposta Pendente'          THEN 'Proposta'
    WHEN 'Proposta em Aprovação RH'   THEN 'Proposta'
    WHEN 'Proposta Aprovada'          THEN 'Proposta'
    WHEN 'Em proposta'                THEN 'Proposta'

    -- documentacao: tres redacoes
    WHEN 'Coleta de Documentos & Exames' THEN 'Documentação'
    WHEN 'Coleta de documentos'          THEN 'Documentação'
    WHEN 'Aguardando ASO'                THEN 'Documentação'

    -- a MP e o documento que cria o Colaborador: ultimo passo antes de Contratado,
    -- nao um encaminhamento
    WHEN 'Processo de MPs'            THEN 'Processo de MP'

    -- recusa da obra e reprovacao; o motivo e dado da Candidatura, nao Etapa
    WHEN 'Recusado pela Obra'         THEN 'Reprovado'

    -- deixam de ser Etapa
    WHEN 'Encaminhado - Obra Específica' THEN NULL
    WHEN 'Encaminhado - Pool Geral'      THEN NULL
    WHEN 'Banco de Talentos'             THEN NULL
    WHEN 'Em entrevista'                 THEN NULL
    WHEN 'Outros'                        THEN NULL
    WHEN 'Currículo Visualizado'         THEN NULL

    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.canonical_stage(text) IS
  'Traduz vocabulario antigo de Etapa para a lista canonica do ADR 0006. NULL = nao e Etapa (ou desconhecido). Nunca aplica default.';

REVOKE ALL ON FUNCTION public.canonical_stage(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.canonical_stage(text) TO authenticated, service_role;

-- Etapas terminais, num lugar so: o trigger de trava e a consulta de violacao usam a mesma lista.
CREATE OR REPLACE FUNCTION public.is_terminal_stage(v_stage text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT coalesce(v_stage, '') IN ('Contratado', 'Reprovado', 'Desistente');
$$;

REVOKE ALL ON FUNCTION public.is_terminal_stage(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_terminal_stage(text) TO authenticated, service_role;
