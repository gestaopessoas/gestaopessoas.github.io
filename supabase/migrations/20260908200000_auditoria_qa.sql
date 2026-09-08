-- ROLLBACK: DROP FUNCTION public.auditoria_qa();
--
-- Auditoria de invariantes do banco, em uma chamada.
--
-- Cada verificacao aqui nasceu de um bug real desta semana. Sao todas do mesmo tipo:
-- coisas que quebram sem levantar erro, e que so aparecem quando alguem vai conferir.
--
--   1. tabelas sem RLS        — `LIKE ... INCLUDING ALL` nao copia policy, e o arquivo
--                               inteiro quase ficou legivel por qualquer autenticado.
--   2. tabelas sem policy     — RLS ligada sem policy nenhuma nega tudo em silencio.
--   3. views `_todos` furadas — se a soma das partes nao bate com o total, alguem inseriu
--                               direto num schema e a costura mente.
--   4. netas nao espelhadas   — cascata desce mais de um nivel; esquecer isso ja custou
--                               47.000 linhas.
--   5. orfaos no arquivo      — o schema `arquivo` NAO tem chave estrangeira (o LIKE nao
--                               copia), entao integridade la e responsabilidade nossa.
--   6. tabelas grandes        — acima de 1.000 linhas, qualquer consulta sem paginacao e
--                               cortada pelo PostgREST sem erro nenhum.
--
-- Read-only. Nao altera nada.

CREATE OR REPLACE FUNCTION public.auditoria_qa()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, arquivo, pg_temp
AS $fn$
DECLARE
  r record;
  n bigint;
  sem_rls        text[] := '{}';
  sem_policy     text[] := '{}';
  todos_furados  text[] := '{}';
  netas_soltas   text[] := '{}';
  orfaos         text[] := '{}';
  grandes        text[] := '{}';
  publico bigint; arquivado bigint; total bigint;
BEGIN
  IF NOT public.can_access('colaboradores', 'view') THEN
    RAISE EXCEPTION 'Sem permissao para rodar a auditoria';
  END IF;

  -- 1 e 2: cobertura de RLS em public e arquivo.
  FOR r IN
    SELECT n.nspname AS esquema, c.relname AS tabela, c.relrowsecurity AS rls,
           (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND n.nspname IN ('public', 'arquivo')
  LOOP
    IF NOT r.rls THEN
      sem_rls := sem_rls || (r.esquema || '.' || r.tabela);
    ELSIF r.policies = 0 THEN
      sem_policy := sem_policy || (r.esquema || '.' || r.tabela);
    END IF;
  END LOOP;

  -- 3: cada view `_todos` tem que ser exatamente a soma das duas fontes.
  FOR r IN
    SELECT c.relname AS view_nome, left(c.relname, length(c.relname) - 6) AS base
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'v' AND n.nspname = 'public' AND c.relname LIKE '%\_todos'
  LOOP
    CONTINUE WHEN to_regclass('arquivo.' || quote_ident(r.base)) IS NULL;
    EXECUTE format('SELECT count(*) FROM public.%I', r.base) INTO publico;
    EXECUTE format('SELECT count(*) FROM arquivo.%I', r.base) INTO arquivado;
    EXECUTE format('SELECT count(*) FROM public.%I', r.view_nome) INTO total;
    IF total <> publico + arquivado THEN
      todos_furados := todos_furados ||
        format('%s: view=%s mas public=%s + arquivo=%s', r.view_nome, total, publico, arquivado);
    END IF;
  END LOOP;

  -- 4: toda filha (em cascata) de uma tabela espelhada precisa ter espelho tambem.
  FOR r IN
    SELECT DISTINCT cl.relname AS neta, ref.relname AS mae
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_class ref ON ref.oid = c.confrelid
    JOIN pg_namespace nref ON nref.oid = ref.relnamespace
    WHERE c.contype = 'f' AND c.confdeltype = 'c' AND nref.nspname = 'public'
      AND to_regclass('arquivo.' || quote_ident(ref.relname)) IS NOT NULL
      AND to_regclass('arquivo.' || quote_ident(cl.relname)) IS NULL
  LOOP
    netas_soltas := netas_soltas || format('%s (filha de %s)', r.neta, r.mae);
  END LOOP;

  -- 5: linha no arquivo apontando para colaborador que nao existe em lugar nenhum.
  FOR r IN
    SELECT cl.relname AS tabela, a.attname AS coluna
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.confrelid = 'public.employees'::regclass AND c.confdeltype = 'c'
      AND to_regclass('arquivo.' || quote_ident(cl.relname)) IS NOT NULL
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM arquivo.%I x WHERE x.%I IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM public.employees_todos e WHERE e.id = x.%I)',
      r.tabela, r.coluna, r.coluna) INTO n;
    IF n > 0 THEN
      orfaos := orfaos || format('arquivo.%s: %s linha(s) sem colaborador', r.tabela, n);
    END IF;
  END LOOP;

  -- 6: acima de 1.000 linhas, consulta sem paginacao volta cortada e sem aviso.
  FOR r IN
    SELECT c.relname AS tabela, c.reltuples::bigint AS estimativa
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND n.nspname = 'public' AND c.reltuples > 1000
    ORDER BY c.reltuples DESC
  LOOP
    grandes := grandes || format('%s (~%s linhas)', r.tabela, r.estimativa);
  END LOOP;

  RETURN jsonb_build_object(
    'tabelas_sem_rls',        to_jsonb(sem_rls),
    'tabelas_sem_policy',     to_jsonb(sem_policy),
    'views_todos_furadas',    to_jsonb(todos_furados),
    'netas_nao_espelhadas',   to_jsonb(netas_soltas),
    'orfaos_no_arquivo',      to_jsonb(orfaos),
    'tabelas_acima_de_1000',  to_jsonb(grandes),
    'quadro_atual',           (SELECT count(*) FROM public.employees),
    'base_inteira',           (SELECT count(*) FROM public.employees_todos)
  );
END; $fn$;

ALTER FUNCTION public.auditoria_qa() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.auditoria_qa() TO authenticated, service_role;
