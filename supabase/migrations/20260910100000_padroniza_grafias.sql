-- ROLLBACK: nao ha para o dado. Restaure do backup se precisar voltar.
--           Para os gatilhos: DROP TRIGGER limpa_espaco ON <tabela>;
--                             DROP FUNCTION public.limpa_espaco_do_texto();
--
-- Padroniza grafias que o cadastro deixou divergirem. Pedido do Bruno em 2026-09-10.
--
-- O QUE ESTAVA ERRADO
--
-- O mesmo valor digitado de dois jeitos vira dois valores para o banco. Nas telas isso
-- aparece como opcao repetida no filtro, item repetido no estoque, e — o caso que
-- morde — cargo que nao encontra a faixa salarial, porque `normalizeRole` compara
-- MAIUSCULA sem tirar acento nem juntar espaco duplo.
--
-- Encontrados na base:
--
--   employee_benefits.benefit_name  CESTA BÁSICA RG (44)  x  CESTA BASICA RG (2)
--   employees.role                  INSTALADOR HIDRÁULICO (3)  x  INSTALADOR HIDRAULICO (1)
--   salary_table.role_name          Auxiliar de Serviços Gerais (10)  x  ...gerais (10)
--   salary_table.role_name          30 linhas com espaco DUPLO no meio
--   uniform_items.name              Camisa Preta (6)  x  Camisa preta (2)
--   uniform_items.name              Camisa Social feminina azul (1)  x  ...social... (1)
--
-- A REGRA, EM VEZ DE SEIS REMENDOS
--
-- 1. Espaco: tira das pontas e junta o duplicado. Mecanico, sem escolha a fazer.
-- 2. Grafia: valores que caem na MESMA chave (sem acento, sem caixa, espaco unico) sao
--    o mesmo valor. Todos passam a usar a grafia VENCEDORA — a mais frequente. Empate
--    decide pela que tem mais letras maiusculas (as tabelas usam Title Case), e o empate
--    seguinte pela ordem alfabetica, so para o resultado ser sempre o mesmo.
--
-- O empate de "Camisa Social feminina azul" (1 x 1) e moeda ao alto: as duas grafias
-- sao igualmente defensaveis. Se a escolhida nao for a que o RH quer, e um UPDATE.
--
-- NAO ACONTECE DE NOVO (a parte mecanica)
--
-- O gatilho `limpa_espaco` normaliza espaco em toda escrita nessas tabelas. Acento e
-- caixa ficam de fora de proposito: sao decisao de quem cadastra, e um gatilho que
-- "corrige" nome proprio faz mais estrago do que conserta.

-- ---------------------------------------------------------------- 1. espaco

CREATE OR REPLACE FUNCTION public.limpa_espaco_do_texto()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  coluna text;
  valor text;
BEGIN
  FOREACH coluna IN ARRAY TG_ARGV LOOP
    EXECUTE format('SELECT ($1).%I', coluna) INTO valor USING NEW;
    IF valor IS NOT NULL THEN
      valor := btrim(regexp_replace(valor, '[[:space:]]+', ' ', 'g'));
      NEW := jsonb_populate_record(NEW, to_jsonb(NEW) || jsonb_build_object(coluna, valor));
    END IF;
  END LOOP;
  RETURN NEW;
END;
$fn$;

ALTER FUNCTION public.limpa_espaco_do_texto() OWNER TO postgres;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('salary_table',      'role_name'),
      ('employee_benefits', 'benefit_name'),
      ('uniform_items',     'name'),
      ('departments',       'name'),
      ('sectors',           'name'),
      ('cost_centers',      'name'),
      ('workplaces',        'name'),
      ('job_profiles',      'title')
    ) AS t(tabela, coluna)
  LOOP
    CONTINUE WHEN to_regclass('public.' || r.tabela) IS NULL;

    EXECUTE format(
      'UPDATE public.%I SET %I = btrim(regexp_replace(%I, ''[[:space:]]+'', '' '', ''g''))
        WHERE %I IS NOT NULL AND %I <> btrim(regexp_replace(%I, ''[[:space:]]+'', '' '', ''g''))',
      r.tabela, r.coluna, r.coluna, r.coluna, r.coluna, r.coluna);

    EXECUTE format('DROP TRIGGER IF EXISTS limpa_espaco ON public.%I', r.tabela);
    EXECUTE format(
      'CREATE TRIGGER limpa_espaco BEFORE INSERT OR UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.limpa_espaco_do_texto(%L)',
      r.tabela, r.coluna);
  END LOOP;
END $$;

-- `employees.role` ja passa por `fn_normalize_employees` (MAIUSCULA + trim). Faltava
-- juntar espaco duplo: sem isso "AUXILIAR  DE OBRAS" e "AUXILIAR DE OBRAS" continuam
-- sendo cargos diferentes para a busca da faixa salarial.
UPDATE public.employees
   SET role = btrim(regexp_replace(role, '[[:space:]]+', ' ', 'g'))
 WHERE role IS NOT NULL AND role <> btrim(regexp_replace(role, '[[:space:]]+', ' ', 'g'));

UPDATE arquivo.employees
   SET role = btrim(regexp_replace(role, '[[:space:]]+', ' ', 'g'))
 WHERE role IS NOT NULL AND role <> btrim(regexp_replace(role, '[[:space:]]+', ' ', 'g'));

-- ---------------------------------------------------------------- 2. grafia

DO $$
DECLARE
  r record;
  g record;
  trocadas integer := 0;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('public.employee_benefits', 'benefit_name'),
      ('public.salary_table',      'role_name'),
      ('public.uniform_items',     'name'),
      ('public.departments',       'name'),
      ('public.sectors',           'name'),
      ('public.cost_centers',      'name'),
      ('public.workplaces',        'name'),
      ('public.job_profiles',      'title')
    ) AS t(tabela, coluna)
  LOOP
    CONTINUE WHEN to_regclass(r.tabela) IS NULL;

    FOR g IN EXECUTE format($q$
      WITH n AS (
        SELECT %I AS valor,
               upper(public.unaccent(regexp_replace(%I, '[[:space:]]+', ' ', 'g'))) AS chave,
               count(*) AS linhas
          FROM %s WHERE %I IS NOT NULL AND btrim(%I) <> '' GROUP BY 1, 2),
      vencedora AS (
        SELECT DISTINCT ON (chave) chave, valor
          FROM n
         ORDER BY chave, linhas DESC,
                  length(regexp_replace(valor, '[^A-ZÀ-Þ]', '', 'g')) DESC,
                  valor)
      SELECT v.chave, v.valor AS fica
        FROM vencedora v
       WHERE (SELECT count(*) FROM n WHERE n.chave = v.chave) > 1
    $q$, r.coluna, r.coluna, r.tabela, r.coluna, r.coluna)
    LOOP
      EXECUTE format(
        'UPDATE %s SET %I = $1
          WHERE upper(public.unaccent(regexp_replace(%I, ''[[:space:]]+'', '' '', ''g''))) = $2
            AND %I <> $1',
        r.tabela, r.coluna, r.coluna, r.coluna) USING g.fica, g.chave;
      trocadas := trocadas + 1;
      RAISE NOTICE 'padronizado em %.%: tudo vira "%"', r.tabela, r.coluna, g.fica;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'grupos de grafia unificados: %', trocadas;
END $$;

-- O cargo mora em DOIS lugares: `public.employees` (quadro atual) e `arquivo.employees`
-- (quem ja saiu). Olhando tabela por tabela a divergencia se esconde — foi o caso de
-- INSTALADOR HIDRÁULICO (3, no quadro) contra INSTALADOR HIDRAULICO (1, no arquivo):
-- cada tabela, sozinha, tinha uma grafia so e parecia consistente. A vencedora aqui e
-- decidida sobre a soma dos dois, e aplicada nos dois.
DO $$
DECLARE g record; trocadas integer := 0;
BEGIN
  FOR g IN
    WITH n AS (
      SELECT role AS valor,
             upper(public.unaccent(regexp_replace(role, '[[:space:]]+', ' ', 'g'))) AS chave,
             count(*) AS linhas
        FROM public.employees_todos
       WHERE role IS NOT NULL AND btrim(role) <> ''
       GROUP BY 1, 2),
    vencedora AS (
      SELECT DISTINCT ON (chave) chave, valor
        FROM n
       ORDER BY chave, linhas DESC,
                length(regexp_replace(valor, '[^A-ZÀ-Þ]', '', 'g')) DESC,
                valor)
    SELECT v.chave, v.valor AS fica
      FROM vencedora v
     WHERE (SELECT count(*) FROM n WHERE n.chave = v.chave) > 1
  LOOP
    UPDATE public.employees
       SET role = g.fica
     WHERE upper(public.unaccent(regexp_replace(role, '[[:space:]]+', ' ', 'g'))) = g.chave
       AND role <> g.fica;

    UPDATE arquivo.employees
       SET role = g.fica
     WHERE upper(public.unaccent(regexp_replace(role, '[[:space:]]+', ' ', 'g'))) = g.chave
       AND role <> g.fica;

    trocadas := trocadas + 1;
    RAISE NOTICE 'cargo padronizado nos dois schemas: tudo vira "%"', g.fica;
  END LOOP;

  RAISE NOTICE 'cargos unificados: %', trocadas;
END $$;

-- ---------------------------------------------------------------- 3. prova

DO $$
DECLARE r record; n bigint; sobrou text[] := '{}';
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('public.employee_benefits', 'benefit_name'),
      ('public.salary_table',      'role_name'),
      ('public.uniform_items',     'name'),
      ('public.employees_todos',   'role'),
      ('public.departments',       'name'),
      ('public.sectors',           'name'),
      ('public.cost_centers',      'name'),
      ('public.workplaces',        'name'),
      ('public.job_profiles',      'title')
    ) AS t(tabela, coluna)
  LOOP
    CONTINUE WHEN to_regclass(r.tabela) IS NULL;

    EXECUTE format($q$
      SELECT count(*) FROM (
        SELECT upper(public.unaccent(regexp_replace(%I, '[[:space:]]+', ' ', 'g')))
          FROM %s WHERE %I IS NOT NULL AND btrim(%I) <> ''
         GROUP BY 1 HAVING count(DISTINCT %I) > 1) x
    $q$, r.coluna, r.tabela, r.coluna, r.coluna, r.coluna) INTO n;
    IF n > 0 THEN sobrou := sobrou || format('%s.%s: %s grupo(s)', r.tabela, r.coluna, n); END IF;

    EXECUTE format(
      'SELECT count(*) FROM %s WHERE %I IS NOT NULL AND %I <> btrim(regexp_replace(%I, ''[[:space:]]+'', '' '', ''g''))',
      r.tabela, r.coluna, r.coluna, r.coluna) INTO n;
    IF n > 0 THEN sobrou := sobrou || format('%s.%s: %s com espaco torto', r.tabela, r.coluna, n); END IF;
  END LOOP;

  IF array_length(sobrou, 1) > 0 THEN
    RAISE EXCEPTION 'Padronizacao incompleta: %', array_to_string(sobrou, ' | ');
  END IF;

  RAISE NOTICE 'Grafias padronizadas: nenhum valor duplicado por acento, caixa ou espaco.';
END $$;
