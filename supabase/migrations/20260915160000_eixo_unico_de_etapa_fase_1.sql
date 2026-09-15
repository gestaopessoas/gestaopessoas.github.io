-- Fase 1 do eixo unico de Etapa (docs/adr/0006-etapa-unica-na-candidatura.md, issue #56).
--
-- Depende da Fase 0 (20260902160000_job_workplace_id.sql), ja aplicada.
--
-- Nenhuma tela muda nesta fase. Quem segura isso e o trigger de traducao de vocabulario
-- (secao 3): tela ainda nao migrada continua gravando a grafia velha, o banco traduz para a
-- Etapa canonica antes do check. O trigger morre na Fase 3.
--
-- Por que trigger e nao codigo: hoje sao cinco caminhos de escrita em job_applications.status
-- (Vagas, Portal do Gestor, Admissao, Entrevistas, candidatura publica) e nenhum garante nada.
-- Mesmo raciocinio do ADR 0003.


-- ---------------------------------------------------------------------------------------
-- 1. Vocabulario canonico
-- ---------------------------------------------------------------------------------------
-- Mapa explicito valor-a-valor. NUNCA um default: o default silencioso e literalmente o bug
-- que o ADR 0006 existe para matar (normalizeStage() devolvia "Nova" para reprovado).
--
-- Tres saidas possiveis, e a diferenca entre elas e o coracao desta funcao:
--   * uma das 13 Etapas canonicas -> valor conhecido, traduzido;
--   * NULL                        -> o valor EXISTE mas deixou de ser Etapa
--                                    ('Banco de Talentos', 'Encaminhado - *', 'Outros',
--                                    'Em entrevista', 'Curriculo Visualizado'). Quem chama
--                                    decide o que fazer; o trigger da secao 3 mantem a Etapa
--                                    onde estava, porque nao-Etapa nao move Etapa.
--   * o proprio valor de volta     -> desconhecido. Sai intacto de proposito, para o check
--                                    da secao 2 barrar alto em vez de o banco adivinhar.
CREATE OR REPLACE FUNCTION public.etapa_canonica(p_valor text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE btrim(COALESCE(p_valor, ''))
    -- Topo do funil
    WHEN ''                              THEN 'Nova'
    WHEN 'Nova'                          THEN 'Nova'
    WHEN 'Nova Aplicação'                THEN 'Nova'
    WHEN 'Nova Aplicacao'                THEN 'Nova'
    WHEN 'Triagem'                       THEN 'Triagem'

    -- Entrevistas. 'Entrevista' solto e a grafia de PIPELINE_STAGES (Vagas), que so tinha
    -- uma etapa de entrevista; a de RH e a que vem antes.
    WHEN 'Entrevista'                    THEN 'Entrevista RH'
    WHEN 'Entrevista RH'                 THEN 'Entrevista RH'
    WHEN 'Entrevista Gestor'             THEN 'Entrevista Gestor'
    WHEN 'Entrevista com Gestor'         THEN 'Entrevista Gestor'
    WHEN 'Entrevista com a Gestão'       THEN 'Entrevista Gestor'
    WHEN 'Testagem Psicológica'          THEN 'Testagem Psicológica'

    -- Obra
    WHEN 'Aguardando Obra'               THEN 'Aguardando Obra'
    WHEN 'Em Avaliação na Obra'          THEN 'Em Avaliação na Obra'
    WHEN 'Em Obra'                       THEN 'Em Obra'

    -- As quatro grafias de proposta colapsam. Nenhum codigo ramifica por elas; a unica
    -- distincao real era de quem grava ('Em proposta' para quem nao e do RH), e isso vira
    -- permissao sobre a transicao, nao valor de Etapa.
    WHEN 'Proposta'                      THEN 'Proposta'
    WHEN 'Proposta Pendente'             THEN 'Proposta'
    WHEN 'Proposta em Aprovação RH'      THEN 'Proposta'
    WHEN 'Proposta Aprovada'             THEN 'Proposta'
    WHEN 'Em proposta'                   THEN 'Proposta'

    -- Documentacao
    WHEN 'Documentação'                  THEN 'Documentação'
    WHEN 'Coleta de Documentos & Exames' THEN 'Documentação'
    WHEN 'Coleta de documentos'          THEN 'Documentação'
    WHEN 'Aguardando ASO'                THEN 'Documentação'

    -- A MP e o documento que cria o Colaborador: ultimo passo antes de Contratado, e nao
    -- um encaminhamento como estava no balde antigo.
    WHEN 'Processo de MP'                THEN 'Processo de MP'
    WHEN 'Processo de MPs'               THEN 'Processo de MP'

    -- Terminais
    WHEN 'Contratado'                    THEN 'Contratado'
    WHEN 'Reprovado'                     THEN 'Reprovado'
    WHEN 'Recusado pela Obra'            THEN 'Reprovado'
    WHEN 'Desistente'                    THEN 'Desistente'

    -- Deixaram de ser Etapa (NULL, ver comentario do cabecalho da funcao).
    -- Encaminhar para uma Obra e abrir Candidatura naquela Obra; para o pool geral, abrir
    -- Candidatura Espontanea. Banco de Talentos virou consulta derivada. Curriculo
    -- Visualizado nunca foi Etapa, e marcador de leitura.
    WHEN 'Encaminhado - Obra Específica' THEN NULL
    WHEN 'Encaminhado - Pool Geral'      THEN NULL
    WHEN 'Banco de Talentos'             THEN NULL
    WHEN 'Banco de talentos'             THEN NULL
    WHEN 'Outros'                        THEN NULL
    WHEN 'Em entrevista'                 THEN NULL
    WHEN 'Currículo Visualizado'         THEN NULL

    -- Desconhecido sai intacto para o check reprovar.
    ELSE btrim(p_valor)
  END;
$$;

COMMENT ON FUNCTION public.etapa_canonica(text) IS
  'Mapa explicito do vocabulario velho para as 13 Etapas canonicas (ADR 0006). NULL = o valor deixou de ser Etapa; valor desconhecido volta intacto para o check barrar.';

REVOKE ALL ON FUNCTION public.etapa_canonica(text) FROM PUBLIC, anon, authenticated;


-- ---------------------------------------------------------------------------------------
-- 2. As 13 Etapas em job_applications.status
-- ---------------------------------------------------------------------------------------
-- Backfill antes do check. Hoje sao zero linhas em producao, mas a migration nao pode
-- depender disso para rodar em outro ambiente.
UPDATE public.job_applications
   SET status = COALESCE(public.etapa_canonica(status), 'Nova')
 WHERE status IS DISTINCT FROM public.etapa_canonica(status);

ALTER TABLE public.job_applications
  ALTER COLUMN status SET DEFAULT 'Nova';

ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_status_check;

-- NOT VALID pelo mesmo motivo de 20260822110000_candidate_interviews_stage_check.sql: vale
-- para toda gravacao nova sem quebrar o deploy por causa de linha legada fora da lista.
ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_status_check CHECK (
    status IS NULL OR status IN (
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
      'Desistente'
    )
  ) NOT VALID;


-- ---------------------------------------------------------------------------------------
-- 3. Traducao de vocabulario (temporaria, morre na Fase 3)
-- ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.job_applications_traduz_etapa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_canonica text;
BEGIN
  v_canonica := public.etapa_canonica(NEW.status);

  IF v_canonica IS NULL THEN
    -- O valor deixou de ser Etapa. Nao-Etapa nao move Etapa: a tela velha continua fazendo
    -- o resto do que faz (search_tags, historico), e a Candidatura fica onde estava.
    IF TG_OP = 'UPDATE' THEN
      NEW.status := OLD.status;
    ELSE
      NEW.status := 'Nova';
    END IF;
  ELSE
    NEW.status := v_canonica;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.job_applications_traduz_etapa() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_job_applications_1_traduz_etapa ON public.job_applications;
CREATE TRIGGER trg_job_applications_1_traduz_etapa
BEFORE INSERT OR UPDATE OF status ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.job_applications_traduz_etapa();

COMMENT ON FUNCTION public.job_applications_traduz_etapa() IS
  'Temporario (Fase 1 -> Fase 3 do ADR 0006): traduz a grafia das telas ainda nao migradas para a Etapa canonica antes do check.';


-- ---------------------------------------------------------------------------------------
-- 4. Etapa Terminal nao volta atras
-- ---------------------------------------------------------------------------------------
-- Reconsiderar um Candidato e abrir Candidatura nova. As demais transicoes ficam livres:
-- recrutamento real pula etapa, e a maquina de estados completa e coisa que se descobre
-- depois de ver o funil rodando com dado limpo.
CREATE OR REPLACE FUNCTION public.job_applications_etapa_terminal_e_final()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status IN ('Contratado', 'Reprovado', 'Desistente')
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION
      'Candidatura % esta em Etapa Terminal (%): para reconsiderar o candidato, abra uma candidatura nova.',
      OLD.id, OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.job_applications_etapa_terminal_e_final() FROM PUBLIC, anon, authenticated;

-- Depois da traducao (ordem alfabetica do nome do trigger decide, e 'trg_job_applications_t'
-- ordena assim): o terminal precisa comparar a Etapa ja canonica, nao a grafia da tela.
DROP TRIGGER IF EXISTS trg_job_applications_2_terminal ON public.job_applications;
CREATE TRIGGER trg_job_applications_2_terminal
BEFORE UPDATE OF status ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.job_applications_etapa_terminal_e_final();


-- ---------------------------------------------------------------------------------------
-- 5. Exclusividade de Obra, agora sobre a Candidatura
-- ---------------------------------------------------------------------------------------
-- A regra e do negocio e sobrevive ao modelo novo: um Candidato pode ter varias Candidaturas
-- ativas, desde que todas na mesma Obra. O que muda e onde ela e verificada -- sai do
-- historico do Candidato (check_active_workplace_lock, que compara workplace_name em texto
-- livre) e passa para a Candidatura, que le a Obra por join ate job_openings.workplace_id.
--
-- A Candidatura NAO copia a Obra. Copiar criaria a terceira fonte de verdade, que e o
-- dead-end da secao 2.3 da auditoria (workplace_name que nao bate com workplaces.name).
--
-- Candidatura sem Obra (vaga antiga com workplace_id NULL, ou pool geral espontaneo) nao
-- opina e nao e bloqueada.
CREATE OR REPLACE FUNCTION public.job_applications_exclusividade_de_obra()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_obra uuid;
  v_conflito text;
BEGIN
  IF NEW.status IN ('Contratado', 'Reprovado', 'Desistente') OR NEW.candidate_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT jo.workplace_id INTO v_obra
    FROM public.job_openings jo
   WHERE jo.id = NEW.job_opening_id;

  IF v_obra IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT w.name INTO v_conflito
    FROM public.job_applications ja
    JOIN public.job_openings jo ON jo.id = ja.job_opening_id
    JOIN public.workplaces w    ON w.id = jo.workplace_id
   WHERE ja.candidate_id = NEW.candidate_id
     AND ja.id IS DISTINCT FROM NEW.id
     AND ja.status NOT IN ('Contratado', 'Reprovado', 'Desistente')
     AND jo.workplace_id IS NOT NULL
     AND jo.workplace_id <> v_obra
   LIMIT 1;

  IF v_conflito IS NOT NULL THEN
    RAISE EXCEPTION 'O candidato ja possui um processo ativo na obra %', v_conflito;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.job_applications_exclusividade_de_obra() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_job_applications_3_exclusividade_de_obra ON public.job_applications;
CREATE TRIGGER trg_job_applications_3_exclusividade_de_obra
BEFORE INSERT OR UPDATE OF status, job_opening_id, candidate_id ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.job_applications_exclusividade_de_obra();


-- ---------------------------------------------------------------------------------------
-- 6. Historico da Etapa em candidate_interviews
-- ---------------------------------------------------------------------------------------
-- A ligacao ja existia e nunca foi usada: candidate_interviews.job_application_id esta no
-- schema desde migrations_legacy/20260729104000, com FK e indice, e nenhuma linha do src/ a
-- le ou escreve.
--
-- workplace_name fica NULL de proposito na linha de historico. A Obra e da Vaga e se le por
-- join (secao 5); preencher aqui recriaria a fonte de verdade em texto livre -- e ainda faria
-- a linha de historico bater no trigger antigo check_active_workplace_lock, que so cai na
-- Fase 2.
CREATE OR REPLACE FUNCTION public.job_applications_grava_historico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.candidate_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.candidate_interviews (candidate_id, job_application_id, stage, notes)
  VALUES (NEW.candidate_id, NEW.id, NEW.status, 'Etapa alterada na candidatura');

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.job_applications_grava_historico() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_job_applications_grava_historico ON public.job_applications;
CREATE TRIGGER trg_job_applications_grava_historico
AFTER UPDATE OF status ON public.job_applications
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION public.job_applications_grava_historico();


-- ---------------------------------------------------------------------------------------
-- 7. Candidatura Espontanea
-- ---------------------------------------------------------------------------------------
-- Uma Publicacao sintetica por Obra, mais uma sem Obra para o pool geral. Uma sintetica
-- global foi rejeitada: deixaria todo espontaneo sem Obra e, portanto, fora da
-- Exclusividade de Obra.
--
-- Sem coluna de marcacao nova: status = 'Espontanea' ja e a marca, e mantem a sintetica fora
-- do portal de carreiras, que filtra status = 'Aberta' (components/careers/fetchCareers.ts).
-- ponytail: se outra tela passar a listar vaga por status diferente de 'Aberta', a sintetica
-- aparece -- ai vira coluna propria.
CREATE UNIQUE INDEX IF NOT EXISTS job_openings_espontanea_por_obra
  ON public.job_openings (COALESCE(workplace_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'Espontanea';

CREATE OR REPLACE FUNCTION public.publicacao_espontanea(p_workplace_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
    FROM public.job_openings
   WHERE status = 'Espontanea'
     AND workplace_id IS NOT DISTINCT FROM p_workplace_id;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.job_openings (status, workplace_id, justification, created_by)
  VALUES ('Espontanea', p_workplace_id, 'Candidatura espontânea (ADR 0006)', 'sistema')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.publicacao_espontanea(uuid) IS
  'Publicacao sintetica onde moram as Candidaturas Espontaneas da Obra (NULL = pool geral). Usada pelo backfill da Fase 1 e pela tela de Entrevistas na Fase 2.';

REVOKE ALL ON FUNCTION public.publicacao_espontanea(uuid) FROM PUBLIC, anon;


-- ---------------------------------------------------------------------------------------
-- 8. Backfill: toda Entrevista passa a ter uma Candidatura
-- ---------------------------------------------------------------------------------------
-- Precedencia dos sinais de reprovacao, quando divergem:
--   interviews.destination > interviews.result > candidates.search_tags
-- destination e escolha explicita do recrutador no fim do processo; result e o parecer de
-- uma entrevista, que pode ser 'Aprovado' com o processo morrendo depois; a tag e derivada e
-- a mais fragil. Sem nenhum sinal, a Candidatura nasce com a Etapa do proprio historico.
--
-- A Obra vem de candidate_interviews.workplace_name casado com workplaces.name (sem caixa e
-- sem espaco nas pontas, que e como o trigger antigo ja comparava). Sem casamento, pool geral.
WITH orfa AS (
  SELECT DISTINCT ON (ci.candidate_id, w.id)
         ci.candidate_id,
         w.id AS workplace_id,
         ci.stage,
         ci.created_at
    FROM public.candidate_interviews ci
    LEFT JOIN public.workplaces w
      ON lower(btrim(w.name)) = lower(btrim(ci.workplace_name))
   WHERE ci.job_application_id IS NULL
     AND ci.candidate_id IS NOT NULL
   ORDER BY ci.candidate_id, w.id, ci.created_at DESC
),
sinal AS (
  SELECT o.*,
         (SELECT i.destination FROM public.interviews i
           WHERE i.candidate_id = o.candidate_id AND i.destination IS NOT NULL
           ORDER BY i.created_at DESC LIMIT 1) AS destination,
         (SELECT i.result FROM public.interviews i
           WHERE i.candidate_id = o.candidate_id AND i.result IS NOT NULL
           ORDER BY i.created_at DESC LIMIT 1) AS result,
         EXISTS (
           SELECT 1 FROM public.candidates c, unnest(COALESCE(c.search_tags, ARRAY[]::text[])) t
            WHERE c.id = o.candidate_id
              AND lower(public.unaccent(t)) IN ('reprovado', 'recusado pela obra', 'desistente')
         ) AS tag_reprovado
    FROM orfa o
)
INSERT INTO public.job_applications (candidate_id, job_opening_id, status, notes, created_at)
SELECT s.candidate_id,
       public.publicacao_espontanea(s.workplace_id),
       CASE
         WHEN s.destination = 'Contratado'  THEN 'Contratado'
         WHEN s.destination = 'Descartado'  THEN 'Reprovado'
         WHEN s.destination = 'Desistente'  THEN 'Desistente'
         WHEN s.destination = 'Banco de Talentos' THEN COALESCE(public.etapa_canonica(s.stage), 'Reprovado')
         WHEN s.result = 'Reprovado'        THEN 'Reprovado'
         WHEN s.tag_reprovado               THEN 'Reprovado'
         ELSE COALESCE(public.etapa_canonica(s.stage), 'Nova')
       END,
       'Candidatura criada pelo backfill da Fase 1 (ADR 0006) a partir do historico de entrevistas.',
       s.created_at
  FROM sinal s;

-- Cada linha de historico orfa aponta para a Candidatura do seu par candidato x Obra.
UPDATE public.candidate_interviews ci
   SET job_application_id = ja.id
  FROM public.job_applications ja
  JOIN public.job_openings jo ON jo.id = ja.job_opening_id
  LEFT JOIN public.workplaces w ON w.id = jo.workplace_id
 WHERE ci.job_application_id IS NULL
   AND ja.candidate_id = ci.candidate_id
   AND lower(btrim(COALESCE(w.name, ''))) = lower(btrim(COALESCE(ci.workplace_name, '')));

-- job_application_id continua NULLABLE nesta fase, ao contrario do que a issue #56 dizia:
-- seis pontos do src/ inserem em candidate_interviews sem esse vinculo (admissao,
-- AddInterviewModal, AdvanceStageModal, RecusaModal, entrevistas, CandidateProfileModal) e
-- NOT NULL agora quebraria as seis telas antes da Fase 2. O NOT NULL entra no fim da Fase 2,
-- junto com a migracao da tela de Entrevistas.


-- ---------------------------------------------------------------------------------------
-- 9. Relatorio: violacoes preexistentes da Exclusividade de Obra
-- ---------------------------------------------------------------------------------------
-- O backfill nao resolve violacao. Encerrar automaticamente a candidatura mais antiga
-- gravaria uma decisao de RH que o backfill nao tem como conhecer -- entao elas saem como
-- aviso no log da migration, para o RH decidir.
DO $relatorio$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN
    SELECT c.full_name AS candidato, string_agg(DISTINCT w.name, ', ') AS obras
      FROM public.job_applications ja
      JOIN public.job_openings jo ON jo.id = ja.job_opening_id
      JOIN public.workplaces w    ON w.id = jo.workplace_id
      JOIN public.candidates c    ON c.id = ja.candidate_id
     WHERE ja.status NOT IN ('Contratado', 'Reprovado', 'Desistente')
     GROUP BY c.id, c.full_name
    HAVING count(DISTINCT jo.workplace_id) > 1
  LOOP
    n := n + 1;
    RAISE WARNING 'Exclusividade de Obra violada: % tem candidatura ativa em % (decisao do RH)', r.candidato, r.obras;
  END LOOP;

  RAISE NOTICE 'Exclusividade de Obra: % violacao(oes) preexistente(s).', n;
END
$relatorio$;


-- ---------------------------------------------------------------------------------------
-- 10. Check do mapa
-- ---------------------------------------------------------------------------------------
-- E onde o bug nasce -- na traducao, nao na tela. Roda junto com a migration: se o mapa
-- quebrar, a migration falha em vez de entregar dado torto.
DO $check$
BEGIN
  -- Todo sinal de reprovacao sai como Reprovado.
  ASSERT public.etapa_canonica('Reprovado')           = 'Reprovado';
  ASSERT public.etapa_canonica('Recusado pela Obra')  = 'Reprovado';

  -- Nenhuma entrada com sinal cai em 'Nova'.
  ASSERT public.etapa_canonica('Testagem Psicológica') <> 'Nova';
  ASSERT public.etapa_canonica('Proposta Aprovada')    <> 'Nova';
  ASSERT public.etapa_canonica('Entrevista Gestor')    <> 'Nova';

  -- Colapsos.
  ASSERT public.etapa_canonica('Em proposta')                    = 'Proposta';
  ASSERT public.etapa_canonica('Proposta em Aprovação RH')       = 'Proposta';
  ASSERT public.etapa_canonica('Aguardando ASO')                 = 'Documentação';
  ASSERT public.etapa_canonica('Coleta de Documentos & Exames')  = 'Documentação';
  ASSERT public.etapa_canonica('Processo de MPs')                = 'Processo de MP';
  ASSERT public.etapa_canonica('Entrevista com a Gestão')        = 'Entrevista Gestor';

  -- Deixaram de ser Etapa.
  ASSERT public.etapa_canonica('Banco de Talentos')              IS NULL;
  ASSERT public.etapa_canonica('Encaminhado - Pool Geral')       IS NULL;
  ASSERT public.etapa_canonica('Currículo Visualizado')          IS NULL;

  -- Desconhecido volta intacto, para o check barrar em vez de o banco adivinhar.
  ASSERT public.etapa_canonica('Valor Que Ninguem Grava') = 'Valor Que Ninguem Grava';

  -- Vazio e ausencia de informacao, nao reprovacao.
  ASSERT public.etapa_canonica(NULL) = 'Nova';
END
$check$;
