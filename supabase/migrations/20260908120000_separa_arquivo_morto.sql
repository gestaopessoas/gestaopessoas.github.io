-- ROLLBACK:
--   INSERT INTO public.employees SELECT * FROM arquivo.employees;
--   (e o mesmo para cada tabela espelho, employees primeiro)
--   DROP SCHEMA arquivo CASCADE;
--   DROP VIEW public.employees_todos, public.employee_archives_todos,
--             public.employee_history_todos, public.employee_benefits_todos,
--             public.benefit_ignores_todos, public.physical_boxes_contagem;
--   e recriar a view public.arquivo_morto na forma anterior (ver ADR 0008).
--
-- Separacao fisica do arquivo morto (decisao do usuario, 2026-09-08).
--
-- public.employees passa a conter SO o quadro atual: 296 de 4.839 linhas. Quem saiu vai
-- para o schema `arquivo`, junto com os registros filhos. Quem precisa da base inteira
-- le a view public.employees_todos.
--
-- Por que schema e nao tabela unica: 30 chaves estrangeiras apontam para employees com
-- ON DELETE CASCADE. Apagar de public sem levar os filhos destruiria 31.777 linhas de
-- historico, beneficios, dossies e snapshot financeiro. As tabelas espelho preservam
-- tudo com a mesma estrutura, entao consulta de arquivo continua sendo SQL normal.
--
-- O schema chama `arquivo` e nao `arquivo_morto` porque ja existe a VIEW
-- public.arquivo_morto; dois objetos de mesmo nome so confundem quem le depois.

CREATE SCHEMA IF NOT EXISTS arquivo;

-- As tabelas espelho sao criadas para TODA filha com CASCADE, tenha ela linha ou nao.
-- Criar so as que tem dado deixaria o schema diferente conforme o banco, e as views
-- abaixo quebrariam num ambiente novo (o banco local sobe vazio).
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('arquivo.employees') IS NULL THEN
    EXECUTE 'CREATE TABLE arquivo.employees (LIKE public.employees INCLUDING ALL)';
  END IF;

  FOR r IN
    SELECT DISTINCT cl.relname AS t
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    WHERE c.contype = 'f' AND c.confrelid = 'public.employees'::regclass AND c.confdeltype = 'c'
  LOOP
    IF to_regclass('arquivo.' || quote_ident(r.t)) IS NULL THEN
      EXECUTE format('CREATE TABLE arquivo.%I (LIKE public.%I INCLUDING ALL)', r.t, r.t);
    END IF;
  END LOOP;

  -- NETAS. Cascata desce quantos niveis existirem: employees -> employee_history ->
  -- employee_history_value_entries. Espelhar so as filhas apagaria as netas em silencio
  -- no DELETE final — foi o que aconteceu na primeira aplicacao desta migration, com
  -- perda de 46.879 linhas de employee_history_value_entries e 121 de
  -- benefit_audit_log_entries (recuperadas depois pela 20260908150000).
  FOR r IN
    SELECT DISTINCT cl.relname AS t
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_class ref ON ref.oid = c.confrelid
    JOIN pg_namespace nref ON nref.oid = ref.relnamespace
    WHERE c.contype = 'f' AND c.confdeltype = 'c' AND nref.nspname = 'public'
      AND ref.relname <> 'employees'
      AND to_regclass('arquivo.' || quote_ident(ref.relname)) IS NOT NULL
  LOOP
    IF to_regclass('arquivo.' || quote_ident(r.t)) IS NULL THEN
      EXECUTE format('CREATE TABLE arquivo.%I (LIKE public.%I INCLUDING ALL)', r.t, r.t);
    END IF;
  END LOOP;
END $$;

-- RLS em tudo. `LIKE ... INCLUDING ALL` NAO copia policy: sem isto o arquivo ficaria
-- com controle de acesso MAIS FRACO que o original — foi exatamente o achado critico da
-- auditoria de 2026-07-30 sobre physical_boxes/employee_archives.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'arquivo'
  LOOP
    EXECUTE format('ALTER TABLE arquivo.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS arquivo_select ON arquivo.%I', r.tablename);
    EXECUTE format($f$CREATE POLICY arquivo_select ON arquivo.%I FOR SELECT TO authenticated
                      USING (public.can_access('colaboradores','view') OR public.can_access('arquivo_morto','view'))$f$, r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS arquivo_no_anon ON arquivo.%I', r.tablename);
    EXECUTE format('CREATE POLICY arquivo_no_anon ON arquivo.%I TO anon USING (false) WITH CHECK (false)', r.tablename);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA arquivo TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA arquivo TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA arquivo TO service_role;

-- Move quem ja saiu. Idempotente: rodar de novo nao duplica nem apaga nada.
DO $$
DECLARE r record; movidos integer;
BEGIN
  CREATE TEMP TABLE _mover ON COMMIT DROP AS
    SELECT id FROM public.employees WHERE status IN ('Inativo','Desligado','Arquivo Morto');
  SELECT count(*) INTO movidos FROM _mover;
  IF movidos = 0 THEN
    RAISE NOTICE 'Nada a mover.';
    RETURN;
  END IF;

  -- Filhas primeiro: depois do DELETE elas ja teriam sido levadas pelo CASCADE.
  FOR r IN
    SELECT DISTINCT cl.relname AS t, a.attname AS col
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.confrelid = 'public.employees'::regclass AND c.confdeltype = 'c'
  LOOP
    EXECUTE format('INSERT INTO arquivo.%I SELECT x.* FROM public.%I x JOIN _mover m ON m.id = x.%I', r.t, r.t, r.col);
  END LOOP;

  -- Netas: a linha vai junto quando a mae ja foi para o arquivo.
  FOR r IN
    SELECT DISTINCT cl.relname AS t, a.attname AS col, ref.relname AS mae, refa.attname AS mae_col
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_class ref ON ref.oid = c.confrelid
    JOIN pg_attribute refa ON refa.attrelid = c.confrelid AND refa.attnum = c.confkey[1]
    JOIN pg_namespace nref ON nref.oid = ref.relnamespace
    WHERE c.contype = 'f' AND c.confdeltype = 'c' AND nref.nspname = 'public'
      AND ref.relname <> 'employees'
      AND to_regclass('arquivo.' || quote_ident(ref.relname)) IS NOT NULL
      AND to_regclass('arquivo.' || quote_ident(cl.relname)) IS NOT NULL
  LOOP
    EXECUTE format(
      'INSERT INTO arquivo.%I SELECT x.* FROM public.%I x WHERE x.%I IN (SELECT %I FROM arquivo.%I)',
      r.t, r.t, r.col, r.mae_col, r.mae);
  END LOOP;

  INSERT INTO arquivo.employees SELECT e.* FROM public.employees e JOIN _mover m ON m.id = e.id;
  DELETE FROM public.employees e USING _mover m WHERE m.id = e.id;
  RAISE NOTICE 'Colaboradores movidos para o arquivo: %', movidos;
END $$;

-- ---------------------------------------------------------------------------
-- Costura: quem precisa da base inteira le daqui.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.employees_todos WITH (security_invoker = on) AS
  SELECT * FROM public.employees
  UNION ALL
  SELECT * FROM arquivo.employees;

COMMENT ON VIEW public.employees_todos IS
  'Quadro atual + arquivo morto. Turnover, analytics, historico e busca leem daqui; a operacao do dia a dia continua em public.colaboradores.';

CREATE OR REPLACE VIEW public.employee_archives_todos WITH (security_invoker = on) AS
  SELECT * FROM public.employee_archives
  UNION ALL
  SELECT * FROM arquivo.employee_archives;

CREATE OR REPLACE VIEW public.employee_history_todos WITH (security_invoker = on) AS
  SELECT * FROM public.employee_history
  UNION ALL
  SELECT * FROM arquivo.employee_history;

CREATE OR REPLACE VIEW public.employee_benefits_todos WITH (security_invoker = on) AS
  SELECT * FROM public.employee_benefits
  UNION ALL
  SELECT * FROM arquivo.employee_benefits;

CREATE OR REPLACE VIEW public.benefit_ignores_todos WITH (security_invoker = on) AS
  SELECT * FROM public.benefit_ignores
  UNION ALL
  SELECT * FROM arquivo.benefit_ignores;

-- A tela de caixas mostra quantos dossies cada caixa guarda. O count embutido do
-- PostgREST nao atravessa view com UNION, entao a contagem vem pronta daqui.
CREATE OR REPLACE VIEW public.physical_boxes_contagem WITH (security_invoker = on) AS
  SELECT pb.id, pb.code, pb.description,
         (SELECT count(*) FROM public.employee_archives_todos ea WHERE ea.box_id = pb.id) AS dossies
  FROM public.physical_boxes pb;

-- A tela lista DOSSIE, nao pessoa (ADR 0008). Vem achatada porque o PostgREST tambem
-- nao embute relacao atraves de view com UNION.
DROP VIEW IF EXISTS public.arquivo_morto;
CREATE VIEW public.arquivo_morto WITH (security_invoker = on) AS
  SELECT
    e.id, e.name, e.cpf, e.rg, e.role, e.unit, e.status, e.dismissed_at,
    ea.id    AS archive_id,
    ea.label AS archive_label,
    pb.id    AS box_id,
    pb.code  AS box_code
  FROM public.employees_todos e
  LEFT JOIN public.employee_archives_todos ea ON ea.employee_id = e.id
  LEFT JOIN public.physical_boxes pb ON pb.id = ea.box_id
  WHERE e.status IN ('Inativo','Desligado','Arquivo Morto') OR ea.id IS NOT NULL;

COMMENT ON VIEW public.arquivo_morto IS
  'Uma linha por dossie: quem saiu, ou quem tem caixa mesmo seguindo ativo (readmissao, CLT que virou PJ). archive_id nulo = arquivado que ainda nao foi encaixotado.';

GRANT SELECT ON public.employees_todos, public.employee_archives_todos,
                public.employee_history_todos, public.employee_benefits_todos,
                public.benefit_ignores_todos, public.physical_boxes_contagem,
                public.arquivo_morto
  TO authenticated, service_role;
