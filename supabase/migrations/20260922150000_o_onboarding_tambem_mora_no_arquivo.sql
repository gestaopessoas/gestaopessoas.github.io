-- ROLLBACK:
--   DROP TABLE arquivo.employee_onboarding;
--   ALTER TABLE arquivo.employee_onboarding_tasks
--     DROP COLUMN due_date, DROP COLUMN completed_at, DROP COLUMN completed_by, DROP COLUMN notes;
--   GRANT ALL ON public.employee_onboarding_tasks TO authenticated;
--   (e reaplicar o ALTER FUNCTION ... OWNER TO postgres que já rodou não tem volta útil --
--    o dono já era postgres nas outras SECURITY DEFINER do repo; isto so deixa esta em par.)
--
-- Fase 1 de Onboarding abriu, sem perceber, o mesmo buraco que a migration
-- 20260914170000_nome_de_registro.sql já tinha fechado uma vez para public.employees.
--
-- POR QUE
--
-- `arquivo.mover_para_arquivo()` (20260908170000) e `public.reativar_colaborador()`
-- (20260908120100, corrigida em 20260909100400) descobrem as filhas de employees
-- dinamicamente via pg_constraint, mas só tocam numa tabela se o espelho dela em `arquivo`
-- já existir, e copiam com `SELECT x.*` -- POR POSIÇÃO, não por nome. As cinco migrations
-- desta fase (20260922140000 a 20260922140400) estenderam uma filha de employees sem
-- atualizar o espelho:
--
--   - 20260922140100 acrescentou due_date, completed_at, completed_by e notes a
--     public.employee_onboarding_tasks. O espelho arquivo.employee_onboarding_tasks
--     continuou com as 4 colunas originais: public foi para 8, arquivo ficou em 4. Um
--     arquivamento hoje quebraria a rotina diária com erro de número de colunas -- ou,
--     pior, se algum dia as 4 primeiras colunas baterem por acaso e as 4 novas não
--     existirem no destino, um `INSERT INTO arquivo.employee_onboarding_tasks SELECT x.*`
--     nem chega a compilar, porque a lista de colunas do INSERT (implícita, todas) não
--     bate em quantidade -- falha visível, mas só no dia em que alguém for arquivado.
--   - 20260922140200 criou public.employee_onboarding, com
--     employee_id ... REFERENCES public.employees(id) ON DELETE CASCADE, e nunca um
--     espelho arquivo.employee_onboarding. Sem o espelho, os dois laços nem tentam mover
--     esta tabela (a condição `to_regclass('arquivo.' || ...) IS NOT NULL` filtra ela fora
--     antes do EXECUTE) -- o cabeçalho de Onboarding de quem for arquivado simplesmente não
--     acompanha a pessoa, e fica orfão em public.employee_onboarding apontando para um
--     employee_id que só existe mais em arquivo.employees.
--
-- Esta migration fecha os dois com a técnica que 20260914170000 já usou: comparar nome de
-- coluna por POSIÇÃO relativa (row_number() sobre ordinal_position, não ordinal_position
-- em si), porque coluna apagada deixa buraco na numeração em uma tabela e não na outra --
-- foi exatamente isso que derrubou o push de produção em 2026-09-14.
--
-- Não há dado para migrar: o Onboarding é feature nova, ninguém com onboarding ainda foi
-- arquivado. Esta migration só torna correto o arquivamento e a reativação DAQUI PARA
-- FRENTE -- não reprocessa nada.

-- ------------------------------------------------------------------------------------
-- 1) arquivo.employee_onboarding_tasks ganha as mesmas 4 colunas, na mesma ordem
-- ------------------------------------------------------------------------------------

ALTER TABLE arquivo.employee_onboarding_tasks
  ADD COLUMN IF NOT EXISTS due_date     date,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid,
  ADD COLUMN IF NOT EXISTS notes        text;

-- ------------------------------------------------------------------------------------
-- 2) arquivo.employee_onboarding: espelho estrutural de public.employee_onboarding
-- ------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS arquivo.employee_onboarding (
  employee_id      uuid PRIMARY KEY,
  started_at       date NOT NULL,
  closed_at        timestamptz,
  close_reason     text CHECK (close_reason IN ('completo', 'prazo')),
  pending_at_close jsonb,
  CONSTRAINT employee_onboarding_fechado_tem_motivo
    CHECK ((closed_at IS NULL) = (close_reason IS NULL))
);

COMMENT ON TABLE arquivo.employee_onboarding IS
  'Espelho de public.employee_onboarding para quem foi arquivado. Sem FK para
   arquivo.employees (o schema arquivo não usa chave estrangeira, como as demais tabelas
   deste schema) -- ver 20260908120000_separa_arquivo_morto.sql.';

ALTER TABLE arquivo.employee_onboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS arquivo_select ON arquivo.employee_onboarding;
CREATE POLICY arquivo_select ON arquivo.employee_onboarding FOR SELECT TO authenticated
  USING (public.can_access('colaboradores','view') OR public.can_access('arquivo_morto','view'));

DROP POLICY IF EXISTS arquivo_no_anon ON arquivo.employee_onboarding;
CREATE POLICY arquivo_no_anon ON arquivo.employee_onboarding TO anon USING (false) WITH CHECK (false);

GRANT SELECT ON arquivo.employee_onboarding TO authenticated;
GRANT ALL ON arquivo.employee_onboarding TO service_role;

-- ------------------------------------------------------------------------------------
-- 3) Paridade de colunas, por POSIÇÃO relativa, não por ordinal_position bruto
--
-- (mesma técnica de 20260914170000_nome_de_registro.sql: comparar ordinal_position direto
-- estaria errado porque coluna apagada deixa buraco na numeração de uma tabela e não da
-- outra -- foi isso que passou no ensaio e caiu em produção em 2026-09-14.)
-- ------------------------------------------------------------------------------------

DO $$
DECLARE desalinhadas integer; publico integer; arq integer;
BEGIN
  WITH p AS (
    SELECT column_name, row_number() OVER (ORDER BY ordinal_position) AS pos
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'employee_onboarding_tasks'),
  a2 AS (
    SELECT column_name, row_number() OVER (ORDER BY ordinal_position) AS pos
      FROM information_schema.columns
     WHERE table_schema = 'arquivo' AND table_name = 'employee_onboarding_tasks')
  SELECT count(*) INTO desalinhadas
    FROM p JOIN a2 ON a2.pos = p.pos
   WHERE p.column_name <> a2.column_name;

  IF desalinhadas > 0 THEN
    RAISE EXCEPTION
      '% coluna(s) fora de ordem entre public.employee_onboarding_tasks e arquivo.employee_onboarding_tasks',
      desalinhadas;
  END IF;

  SELECT count(*) INTO publico FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'employee_onboarding_tasks';
  SELECT count(*) INTO arq FROM information_schema.columns
   WHERE table_schema = 'arquivo' AND table_name = 'employee_onboarding_tasks';
  IF publico <> arq THEN
    RAISE EXCEPTION
      'employee_onboarding_tasks ficou com % colunas em public e % em arquivo', publico, arq;
  END IF;

  WITH p AS (
    SELECT column_name, row_number() OVER (ORDER BY ordinal_position) AS pos
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'employee_onboarding'),
  a2 AS (
    SELECT column_name, row_number() OVER (ORDER BY ordinal_position) AS pos
      FROM information_schema.columns
     WHERE table_schema = 'arquivo' AND table_name = 'employee_onboarding')
  SELECT count(*) INTO desalinhadas
    FROM p JOIN a2 ON a2.pos = p.pos
   WHERE p.column_name <> a2.column_name;

  IF desalinhadas > 0 THEN
    RAISE EXCEPTION
      '% coluna(s) fora de ordem entre public.employee_onboarding e arquivo.employee_onboarding',
      desalinhadas;
  END IF;

  SELECT count(*) INTO publico FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'employee_onboarding';
  SELECT count(*) INTO arq FROM information_schema.columns
   WHERE table_schema = 'arquivo' AND table_name = 'employee_onboarding';
  IF publico <> arq THEN
    RAISE EXCEPTION
      'employee_onboarding ficou com % colunas em public e % em arquivo', publico, arq;
  END IF;

  RAISE NOTICE 'Onboarding em par com o arquivo: employee_onboarding_tasks com % colunas, employee_onboarding com % colunas nos dois schemas.', publico, arq;
END $$;

-- ------------------------------------------------------------------------------------
-- C2: employee_onboarding_tasks nasceu antes do padrão REVOKE ALL / GRANT deste branch
--
-- A tabela veio de 20260814202133 com `GRANT ... DELETE` explícito, mais o que o baseline
-- (ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES) já tinha dado a authenticated antes
-- disso. Sob a policy FOR ALL (USING can_access('colaboradores','view')), e como o Postgres
-- só consulta USING -- nunca WITH CHECK -- em DELETE, qualquer autenticado com acesso
-- SOMENTE DE LEITURA a Colaboradores podia apagar linha do que esta fase transformou em
-- trilha de auditoria (completed_at/completed_by). Mesmo fechamento de
-- 20260922140000_catalogo_de_tarefas_do_onboarding.sql e
-- 20260922140200_o_onboarding_tem_cabecalho.sql: REVOKE ALL antes do GRANT, porque revogar
-- só DELETE deixaria TRUNCATE/REFERENCES/TRIGGER de pé.
-- ------------------------------------------------------------------------------------

REVOKE ALL ON public.employee_onboarding_tasks FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.employee_onboarding_tasks TO authenticated;

-- ------------------------------------------------------------------------------------
-- I1 + item 8: hardening uniforme nas três funções de gatilho que ficaram de fora
--
-- Nenhuma das três é alcançável via PostgREST (todas RETURNS trigger), então isto não
-- fecha um buraco vivo -- é deixar o padrão uniforme e legível, igual
-- onboarding_materializar e onboarding_abre_na_admissao já tem (20260922140300).
-- ------------------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.onboarding_assina_tarefa() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.onboarding_fecha_quando_completa() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.onboarding_impede_reabertura() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.onboarding_assina_tarefa() IS
  'Grava completed_at/completed_by de forma autoritativa a cada INSERT ou UPDATE, ignorando qualquer valor que o cliente tente forjar.';
COMMENT ON FUNCTION public.onboarding_fecha_quando_completa() IS
  'Fecha o cabeçalho de Onboarding por completude assim que a última tarefa é marcada, travando a linha do cabeçalho contra write skew.';
COMMENT ON FUNCTION public.onboarding_impede_reabertura() IS
  'Impede que closed_at/close_reason/pending_at_close mudem depois que o Onboarding já fechou.';

-- Nenhuma das seis funções desta fase fixou o dono explicitamente, ao contrário de toda
-- outra função SECURITY DEFINER do repo (arquivo.mover_para_arquivo, reativar_colaborador,
-- etc.), que termina com ALTER FUNCTION ... OWNER TO postgres. Corrigindo para frente, sem
-- reescrever as quatro migrations já aplicadas -- editar migration já rodada não muda nada
-- num banco que já a aplicou, e a convenção deste repo (ver 20260814202133 vs os arquivos
-- seguintes) é corrigir com uma migration nova, não reescrever histórico.
ALTER FUNCTION public.onboarding_materializar(uuid) OWNER TO postgres;
ALTER FUNCTION public.onboarding_abre_na_admissao() OWNER TO postgres;
ALTER FUNCTION public.onboarding_assina_tarefa() OWNER TO postgres;
ALTER FUNCTION public.onboarding_encerrar_vencidos() OWNER TO postgres;
ALTER FUNCTION public.onboarding_fecha_quando_completa() OWNER TO postgres;
ALTER FUNCTION public.onboarding_impede_reabertura() OWNER TO postgres;
