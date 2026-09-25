-- ROLLBACK:
--   ALTER TABLE public.employees  DROP COLUMN contract_end_date;
--   ALTER TABLE arquivo.employees DROP COLUMN contract_end_date;
--   (a view `SELECT *` precisa ser recriada com DROP/CREATE depois disso, e o gatilho
--   pode ficar como esta: ele le as colunas do catalogo)
--
-- Estagio e Jovem Aprendiz tem contrato com prazo. A data de fim passa a existir no
-- cadastro; a tela exige o campo para esses dois tipos e avisa aos 30, 20 e 10 dias.
--
-- Sem CHECK no banco de proposito: quem ja esta cadastrado nao tem a data, e uma
-- constraint travaria QUALQUER escrita nessas linhas -- inclusive o envio de foto pela
-- pagina publica e a rotina diaria do arquivo. A tela lista esses casos como
-- "sem data" para o RH completar.
--
-- Nos dois schemas pelo mesmo motivo da 20260914170000: o arquivo copia por posicao.

ALTER TABLE public.employees  ADD COLUMN IF NOT EXISTS contract_end_date date;
ALTER TABLE arquivo.employees ADD COLUMN IF NOT EXISTS contract_end_date date;

COMMENT ON COLUMN public.employees.contract_end_date IS
  'Fim do termo de contrato de Estagio / Jovem Aprendiz. Obrigatorio na tela para esses tipos; NULL nos demais.';

DO $$
DECLARE publico integer; arq integer; desalinhadas integer;
BEGIN
  SELECT count(*) INTO publico FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'employees';
  SELECT count(*) INTO arq FROM information_schema.columns
   WHERE table_schema = 'arquivo' AND table_name = 'employees';

  IF publico <> arq THEN
    RAISE EXCEPTION 'employees ficou com % colunas em public e % em arquivo', publico, arq;
  END IF;

  -- Compara a ORDEM das colunas vivas, nao ordinal_position (ver 20260914170000).
  WITH p AS (
    SELECT column_name, row_number() OVER (ORDER BY ordinal_position) AS pos
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'employees'),
  a2 AS (
    SELECT column_name, row_number() OVER (ORDER BY ordinal_position) AS pos
      FROM information_schema.columns
     WHERE table_schema = 'arquivo' AND table_name = 'employees')
  SELECT count(*) INTO desalinhadas
    FROM p JOIN a2 ON a2.pos = p.pos
   WHERE p.column_name <> a2.column_name;

  IF desalinhadas > 0 THEN
    RAISE EXCEPTION '% coluna(s) fora de ordem entre public.employees e arquivo.employees',
      desalinhadas;
  END IF;
END $$;

-- A view congela a lista de colunas quando e criada. CREATE OR REPLACE acrescenta a
-- coluna nova no fim e preserva os DEFAULTs da 20260918120000 e os GRANTs.
CREATE OR REPLACE VIEW public.employees_todos WITH (security_invoker = on) AS
  SELECT * FROM public.employees
  UNION ALL
  SELECT * FROM arquivo.employees;

-- ------------------------------------------------------------------------------------
-- O GATILHO DE ESCRITA PARA DE TER LISTA DE COLUNAS
--
-- Cada coluna nova exigia copiar a lista de ~57 colunas duas vezes. A copia da
-- 20260918090000 partiu de uma versao antiga e perdeu `pharmacy_card` e
-- `registered_name`: desde 18/09, editar a ficha de quem ja existe descartava em
-- silencio o cartao da farmacia e o nome de registro (o cadastro novo gravava, porque o
-- INSERT usa NEW.*).
--
-- Agora o UPDATE monta a lista a partir do catalogo de `public.employees`, na hora.
-- Coluna nova passa a ser gravada sem mexer aqui. Nomes vem de pg_attribute com
-- quote_ident; valores vao por USING, nunca concatenados.
--
-- ponytail: uma consulta a pg_attribute por linha gravada. A tela grava uma ficha por
-- vez; se virar carga em lote, cachear `cols` numa variavel de sessao.
CREATE OR REPLACE FUNCTION public.employees_todos_escrita()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, arquivo, pg_temp
AS $fn$
DECLARE
  cols text;
  n integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Cadastro novo nasce no quadro atual. Vai para o arquivo quando for desligado.
    INSERT INTO public.employees VALUES (NEW.*);
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.employees WHERE id = OLD.id;
    IF NOT FOUND THEN DELETE FROM arquivo.employees WHERE id = OLD.id; END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: escreve onde a pessoa esta. Todas as colunas menos `id`; as duas tabelas tem
  -- as mesmas colunas na mesma ordem (conferido acima e em toda migration de employees).
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO cols
    FROM pg_attribute
   WHERE attrelid = 'public.employees'::regclass
     AND attnum > 0 AND NOT attisdropped AND attgenerated = ''
     AND attname <> 'id';

  -- EXECUTE nao atualiza FOUND; por isso o ROW_COUNT.
  EXECUTE format('UPDATE public.employees SET (%1$s) = (SELECT %1$s FROM (SELECT ($1).*) AS n) WHERE id = ($1).id', cols)
    USING NEW;
  GET DIAGNOSTICS n = ROW_COUNT;

  IF n = 0 THEN
    EXECUTE format('UPDATE arquivo.employees SET (%1$s) = (SELECT %1$s FROM (SELECT ($1).*) AS n) WHERE id = ($1).id', cols)
      USING NEW;
  END IF;

  RETURN NEW;
END; $fn$;

DO $$
DECLARE tem integer;
BEGIN
  SELECT count(*) INTO tem FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'employees_todos'
     AND column_name = 'contract_end_date';

  IF tem <> 1 THEN
    RAISE EXCEPTION 'A view employees_todos nao entrega contract_end_date';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
