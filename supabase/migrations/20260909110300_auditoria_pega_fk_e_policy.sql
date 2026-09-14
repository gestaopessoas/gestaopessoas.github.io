-- ROLLBACK: reaplique 20260908200000_auditoria_qa.sql
--
-- Duas verificacoes novas, uma para cada buraco fechado hoje.
--
-- 7. `fks_do_arquivo_faltando` — o schema `arquivo` ganhou chave estrangeira entre mae
--    e filha (20260909110000). Uma tabela espelhada NOVA volta a nascer sem, porque
--    `LIKE ... INCLUDING ALL` nao copia FK. Sem FK, mover metade de um par nao e barrado
--    por nada, e foi assim que 36 linhas de valor perderam a capa.
--
-- 8. `policies_divergentes_da_origem` — as policies do arquivo passaram a ser copia da
--    regra de leitura da origem (20260909110100). Se alguem apertar a regra em `public`
--    e esquecer o espelho, o arquivo fica frouxo de novo em silencio. Esta verificacao
--    recalcula a expressao esperada e compara.
--
-- As duas sao do mesmo tipo das outras seis: coisas que nao levantam erro nenhum e so
-- aparecem quando alguem vai conferir.

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
  esperado text;
  atual text;
  sem_rls        text[] := '{}';
  sem_policy     text[] := '{}';
  todos_furados  text[] := '{}';
  netas_soltas   text[] := '{}';
  orfaos         text[] := '{}';
  grandes        text[] := '{}';
  fks_faltando   text[] := '{}';
  policies_ruins text[] := '{}';
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

  -- 7: FK em cascata entre mae e filha espelhadas precisa existir tambem no arquivo.
  FOR r IN
    SELECT DISTINCT c.conname, cl.relname AS filha, ref.relname AS mae
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_class ref ON ref.oid = c.confrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE c.contype = 'f' AND c.confdeltype = 'c' AND n.nspname = 'public'
      AND ref.relname <> 'employees'
      AND to_regclass('arquivo.' || quote_ident(cl.relname))  IS NOT NULL
      AND to_regclass('arquivo.' || quote_ident(ref.relname)) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint x
        JOIN pg_class xc ON xc.oid = x.conrelid
        JOIN pg_namespace xn ON xn.oid = xc.relnamespace
        WHERE xn.nspname = 'arquivo' AND xc.relname = cl.relname AND x.contype = 'f')
  LOOP
    fks_faltando := fks_faltando || format('arquivo.%s -> arquivo.%s', r.filha, r.mae);
  END LOOP;

  -- 8: a policy do espelho tem que ser a regra de leitura da origem.
  FOR r IN
    SELECT c.relname AS tabela
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'arquivo' AND c.relkind = 'r'
      AND to_regclass('public.' || quote_ident(c.relname)) IS NOT NULL
  LOOP
    SELECT coalesce(string_agg('(' || pg_get_expr(p.polqual, p.polrelid) || ')', ' OR '), 'false')
      INTO esperado
    FROM pg_policy p
    WHERE p.polrelid = to_regclass('public.' || quote_ident(r.tabela))
      AND p.polpermissive AND p.polcmd IN ('r', '*') AND p.polqual IS NOT NULL
      AND pg_get_expr(p.polqual, p.polrelid) <> 'false'
      AND (p.polroles = '{0}'::oid[] OR 'authenticated' = ANY (
            SELECT rolname FROM pg_roles WHERE oid = ANY (p.polroles)));

    SELECT pg_get_expr(p.polqual, p.polrelid) INTO atual
    FROM pg_policy p
    WHERE p.polrelid = to_regclass('arquivo.' || quote_ident(r.tabela))
      AND p.polname = 'arquivo_select';

    -- Comparacao sem espaco nem parentese: o Postgres reescreve a expressao ao guardar
    -- ("(true)" vira "true", "(a) OR (b)" vira "(a OR b)"), entao comparar o texto cru
    -- acusaria as 35 tabelas como divergentes. O que interessa e o modulo e a acao
    -- pedidos — e esses sobrevivem a normalizacao.
    IF atual IS NULL THEN
      policies_ruins := policies_ruins || format('arquivo.%s: sem policy de leitura', r.tabela);
    ELSIF regexp_replace(atual, '[[:space:]()]', '', 'g')
       IS DISTINCT FROM regexp_replace(esperado, '[[:space:]()]', '', 'g') THEN
      policies_ruins := policies_ruins ||
        format('arquivo.%s: espelho=%s | origem=%s', r.tabela, left(atual, 80), left(esperado, 80));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'tabelas_sem_rls',                to_jsonb(sem_rls),
    'tabelas_sem_policy',             to_jsonb(sem_policy),
    'views_todos_furadas',            to_jsonb(todos_furados),
    'netas_nao_espelhadas',           to_jsonb(netas_soltas),
    'orfaos_no_arquivo',              to_jsonb(orfaos),
    'fks_do_arquivo_faltando',        to_jsonb(fks_faltando),
    'policies_divergentes_da_origem', to_jsonb(policies_ruins),
    'tabelas_acima_de_1000',          to_jsonb(grandes),
    'quadro_atual',                   (SELECT count(*) FROM public.employees),
    'base_inteira',                   (SELECT count(*) FROM public.employees_todos)
  );
END; $fn$;

ALTER FUNCTION public.auditoria_qa() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.auditoria_qa() TO authenticated, service_role;
