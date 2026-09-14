-- ROLLBACK: nao ha para o dado. Esta migration REESCREVE 78 CPFs e APAGA um (o da ficha
--           duplicada). Restaure do backup se precisar voltar.
--           Para a funcao: reaplique o corpo anterior de fn_normalize_employees, sem o
--           bloco do CPF.
--
-- Todo CPF passa a ser gravado com pontuacao. Decisao do Bruno em 2026-09-09.
--
-- POR QUE
--
-- O CPF vinha em dois formatos: 243 cadastros com pontuacao ("000.000.000-00") e 79 so
-- com digitos ("00000000000"). O indice unico compara texto, entao os dois NUNCA
-- colidiam — e o formulario sempre aplica a mascara. Resultado: recadastrar alguem cujo
-- CPF antigo tinha sido salvo sem pontuacao passava batido e criava uma segunda ficha da
-- mesma pessoa.
--
-- Ja aconteceu: uma colaboradora ativa e uma ficha antiga dela, com o sobrenome escrito
-- a ficha arquivada (desligada) sao a mesma pessoa, com um "L" a mais no nome.
--
-- ONDE A REGRA MORA
--
-- Em `fn_normalize_employees`, que ja e o lugar onde nome, cargo e e-mail sao
-- padronizados a cada escrita. Assim a garantia nao depende da mascara do formulario:
-- vale para importacao, API, ou qualquer tela nova que venha a existir.
--
-- Ressalva honesta: esse gatilho esta so em `public.employees`. Editar a ficha de um
-- ARQUIVADO escreve em `arquivo.employees`, que nao o tem. Na pratica nao morde, porque
-- o formulario mascara e o gatilho de unicidade compara so os digitos — mas se um dia
-- alguem escrever no arquivo por fora, o formato pode escapar.
--
-- A FICHA DUPLICADA
--
-- Bruno decidiu (2026-09-10): vale a ATIVA, e a ficha antiga sai. Ele vai recadastrar a
-- passagem a mao depois.
--
-- Antes de apagar, a ficha inteira foi exportada para
-- `backups/ficha-duplicada-20260910.json` — colaborador + 49 mudancas de historico
-- com os valores velho/novo de cada uma. Ela nao tinha dossie em caixa nem beneficio,
-- entao o historico era tudo que existia.
--
-- As filhas precisam ser apagadas explicitamente: o schema `arquivo` NAO tem chave
-- estrangeira apontando para `employees` (e nao pode ter — reativar apaga a linha de
-- `arquivo.employees` de proposito, e uma cascata dali levaria os dossies das passagens
-- anteriores, que o ADR 0008 manda preservar). O laco abaixo faz o que a FK nao faz.
--
-- Sem remover esta ficha a normalizacao logo abaixo bateria no gatilho de unicidade e a
-- migration falharia.

-- 1. A regra, no gatilho que ja existia.
CREATE OR REPLACE FUNCTION public.fn_normalize_employees()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NEW.name IS NOT NULL THEN NEW.name := UPPER(TRIM(NEW.name)); END IF;
  IF NEW.role IS NOT NULL THEN NEW.role := UPPER(TRIM(NEW.role)); END IF;
  IF NEW.cost_center IS NOT NULL THEN NEW.cost_center := UPPER(TRIM(NEW.cost_center)); END IF;
  IF NEW.unit IS NOT NULL THEN NEW.unit := UPPER(TRIM(NEW.unit)); END IF;
  IF NEW.workplace IS NOT NULL THEN NEW.workplace := UPPER(TRIM(NEW.workplace)); END IF;
  IF NEW.seniority IS NOT NULL THEN NEW.seniority := UPPER(TRIM(NEW.seniority)); END IF;
  IF NEW.email_corporate IS NOT NULL THEN NEW.email_corporate := LOWER(TRIM(NEW.email_corporate)); END IF;
  IF NEW.email_personal IS NOT NULL THEN NEW.email_personal := LOWER(TRIM(NEW.email_personal)); END IF;

  -- CPF sempre "000.000.000-00". Fora de 11 digitos, guarda como veio: e dado torto que
  -- alguem precisa olhar, e reformatar so esconderia o problema.
  IF NEW.cpf IS NOT NULL AND length(regexp_replace(NEW.cpf, '[^0-9]', '', 'g')) = 11 THEN
    NEW.cpf := regexp_replace(regexp_replace(NEW.cpf, '[^0-9]', '', 'g'),
                              '(\d{3})(\d{3})(\d{3})(\d{2})', '\1.\2.\3-\4');
  END IF;

  RETURN NEW;
END;
$fn$;

-- 2. Remove a ficha duplicada (ver comentario acima; copia em backups/).
DO $$
DECLARE alvo uuid; quantas integer; r record; apagadas integer := 0; n integer;
BEGIN
  -- A ficha duplicada e achada pela REGRA, nao pelo nome: uma ficha no arquivo com o
  -- MESMO CPF de uma ficha ativa, porem com o nome escrito DIFERENTE.
  --
  -- Nome e CPF nao ficam neste arquivo de proposito: o repositorio e publico e o
  -- historico do git nao esquece.
  --
  -- A diferenca de grafia e o que separa duplicata de readmissao: quem foi readmitido
  -- aparece nos dois lugares com o MESMO nome, e nao pode ser apagado.
  -- `min()` nao aceita uuid, entao conta e escolhe em dois passos.
  SELECT count(*) INTO quantas
    FROM arquivo.employees a
    JOIN public.employees p
      ON regexp_replace(p.cpf, '[^0-9]', '', 'g') = regexp_replace(a.cpf, '[^0-9]', '', 'g')
   WHERE a.cpf IS NOT NULL
     AND length(regexp_replace(a.cpf, '[^0-9]', '', 'g')) = 11
     AND a.name <> p.name;

  SELECT a.id INTO alvo
    FROM arquivo.employees a
    JOIN public.employees p
      ON regexp_replace(p.cpf, '[^0-9]', '', 'g') = regexp_replace(a.cpf, '[^0-9]', '', 'g')
   WHERE a.cpf IS NOT NULL
     AND length(regexp_replace(a.cpf, '[^0-9]', '', 'g')) = 11
     AND a.name <> p.name
   LIMIT 1;

  IF quantas = 0 THEN
    RAISE NOTICE 'nenhuma ficha duplicada por grafia; nada a remover';
    RETURN;
  END IF;

  -- Mais de uma: nao adivinho qual apagar. DELETE nao e lugar para chute.
  IF quantas > 1 THEN
    RAISE EXCEPTION 'achei % fichas duplicadas por grafia; resolva uma a uma antes', quantas;
  END IF;

  -- Filhas primeiro. As netas vao junto pelas FKs internas do arquivo (20260909110000).
  FOR r IN
    SELECT DISTINCT cl.relname AS t, a.attname AS col
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.confrelid = 'public.employees'::regclass AND c.confdeltype = 'c'
      AND to_regclass('arquivo.' || quote_ident(cl.relname)) IS NOT NULL
  LOOP
    EXECUTE format('DELETE FROM arquivo.%I WHERE %I = $1', r.t, r.col) USING alvo;
    GET DIAGNOSTICS n = ROW_COUNT;
    apagadas := apagadas + n;
  END LOOP;

  DELETE FROM arquivo.employees WHERE id = alvo;
  RAISE NOTICE 'ficha duplicada removida: % linha(s) filhas + o colaborador', apagadas;
END $$;

-- 3. Padroniza o que ja estava gravado.
--
-- `trg_log_employee_changes` fica DESLIGADO durante estes UPDATE. Isto e mudanca de
-- FORMATO, nao de dado: registrar 73 "alteracoes em cpf" encheria o Log de Historico de
-- ruido e, pior, o botao "Reverter" daquela tela devolveria o CPF sem pontuacao — ou
-- seja, o proprio historico viraria uma forma de desfazer esta migration por engano.
ALTER TABLE public.employees DISABLE TRIGGER trg_log_employee_changes;

UPDATE public.employees
   SET cpf = regexp_replace(regexp_replace(cpf, '[^0-9]', '', 'g'),
                            '(\d{3})(\d{3})(\d{3})(\d{2})', '\1.\2.\3-\4')
 WHERE cpf IS NOT NULL
   AND cpf !~ '[^0-9]'
   AND length(regexp_replace(cpf, '[^0-9]', '', 'g')) = 11;

ALTER TABLE public.employees ENABLE TRIGGER trg_log_employee_changes;

UPDATE arquivo.employees
   SET cpf = regexp_replace(regexp_replace(cpf, '[^0-9]', '', 'g'),
                            '(\d{3})(\d{3})(\d{3})(\d{2})', '\1.\2.\3-\4')
 WHERE cpf IS NOT NULL
   AND cpf !~ '[^0-9]'
   AND length(regexp_replace(cpf, '[^0-9]', '', 'g')) = 11;

-- 4. Prova. A migration falha em vez de deixar a base meio arrumada.
DO $$
DECLARE crus integer; repetidos integer; gatilho_ligado boolean;
BEGIN
  SELECT count(*) INTO crus FROM public.employees_todos
   WHERE cpf IS NOT NULL AND cpf <> '' AND cpf !~ '[^0-9]';

  SELECT count(*) INTO repetidos FROM (
    SELECT regexp_replace(cpf, '[^0-9]', '', 'g')
      FROM public.employees_todos WHERE cpf IS NOT NULL AND cpf <> ''
     GROUP BY 1 HAVING count(*) > 1) x;

  SELECT tgenabled <> 'D' INTO gatilho_ligado
    FROM pg_trigger WHERE tgrelid = 'public.employees'::regclass
     AND tgname = 'trg_log_employee_changes';

  IF EXISTS (SELECT 1 FROM arquivo.employees a
               JOIN public.employees p
                 ON regexp_replace(p.cpf, '[^0-9]', '', 'g') = regexp_replace(a.cpf, '[^0-9]', '', 'g')
              WHERE a.name <> p.name
                AND length(regexp_replace(a.cpf, '[^0-9]', '', 'g')) = 11) THEN
    RAISE EXCEPTION 'Falhou: a ficha duplicada ainda existe';
  END IF;

  IF crus > 0 OR repetidos > 0 OR NOT gatilho_ligado THEN
    RAISE EXCEPTION
      'Falhou: % sem pontuacao, % repetido(s), log de historico ligado = %',
      crus, repetidos, gatilho_ligado;
  END IF;

  RAISE NOTICE 'CPFs padronizados. 0 sem pontuacao, 0 repetidos, log de historico religado.';
END $$;
