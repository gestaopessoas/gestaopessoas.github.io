-- ROLLBACK: DROP TRIGGER employees_limpa_arquivo ON public.employees;
--           DROP FUNCTION public.limpa_arquivo_ao_apagar_colaborador();
--
-- Apagar um colaborador de vez deixava os registros dele orfaos no arquivo.
--
-- `public.employees` tem 30 filhas com `ON DELETE CASCADE`: apagar a pessoa leva tudo
-- junto. O schema `arquivo` NAO tem chave estrangeira para `employees` — e nao pode
-- ter, porque `reativar_colaborador()` apaga de proposito a linha de `arquivo.employees`
-- e uma cascata dali levaria os dossies das passagens anteriores, que o ADR 0008 manda
-- preservar.
--
-- Consequencia: quem tinha passagem arquivada e depois foi apagado do cadastro deixava
-- para tras dossies, historico e valores apontando para um colaborador inexistente.
-- Medido em ambiente de teste: 18 dossies orfaos numa tarde de execucoes.
--
-- O gatilho abaixo faz a cascata que a FK nao pode fazer.
--
-- A CONDICAO QUE EVITA O DESASTRE
--
-- `arquivar_colaboradores()` tambem apaga de `public.employees` — depois de ter copiado
-- a pessoa para `arquivo.employees`. Sem distinguir os dois casos, este gatilho apagaria
-- justamente o que acabou de ser arquivado. Por isso a primeira coisa que ele faz e
-- perguntar se a pessoa existe em `arquivo.employees`: se existe, isto e uma MUDANCA DE
-- LUGAR e nao ha nada a limpar. Se nao existe, e exclusao de verdade.
--
-- As netas nao aparecem no laco: desde 20260909110000 o proprio schema `arquivo` tem
-- FK em cascata entre mae e filha, entao apagar a mae ja leva as netas.

CREATE OR REPLACE FUNCTION public.limpa_arquivo_ao_apagar_colaborador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, arquivo, pg_temp
AS $fn$
DECLARE r record;
BEGIN
  -- Arquivamento em curso (a linha ja foi copiada): nao e exclusao, e mudanca de lugar.
  IF EXISTS (SELECT 1 FROM arquivo.employees WHERE id = OLD.id) THEN
    RETURN OLD;
  END IF;

  FOR r IN
    SELECT DISTINCT cl.relname AS t, a.attname AS col
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.confrelid = 'public.employees'::regclass AND c.confdeltype = 'c'
      AND to_regclass('arquivo.' || quote_ident(cl.relname)) IS NOT NULL
  LOOP
    EXECUTE format('DELETE FROM arquivo.%I WHERE %I = $1', r.t, r.col) USING OLD.id;
  END LOOP;

  RETURN OLD;
END;
$fn$;

ALTER FUNCTION public.limpa_arquivo_ao_apagar_colaborador() OWNER TO postgres;

DROP TRIGGER IF EXISTS employees_limpa_arquivo ON public.employees;
CREATE TRIGGER employees_limpa_arquivo
  BEFORE DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.limpa_arquivo_ao_apagar_colaborador();
