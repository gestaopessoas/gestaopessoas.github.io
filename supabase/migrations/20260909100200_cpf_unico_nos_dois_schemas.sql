-- ROLLBACK: DROP TRIGGER employees_cpf_unico ON public.employees;
--           DROP TRIGGER employees_cpf_unico ON arquivo.employees;
--           DROP FUNCTION public.cpf_unico_nos_dois_schemas();
--
-- A separacao do arquivo morto furou a trava de CPF.
--
-- `employees_cpf_unique` e um indice unico, e indice unico vale por TABELA. Com os
-- 4.543 arquivados em `arquivo.employees`, os CPFs deles sairam do alcance da trava de
-- `public.employees`: da para recadastrar um ex-colaborador e criar duas fichas da
-- mesma pessoa, sem erro nenhum.
--
-- E ha um segundo furo, maior, encontrado testando a tela: o CPF e gravado em DOIS
-- formatos. Hoje sao 243 cadastros com pontuacao ("000.000.000-00") e 79 so com digitos
-- ("00000000000"). Como o indice unico compara texto, esses dois nunca colidem — e o
-- proprio formulario aplica a mascara, entao recadastrar alguem cujo CPF antigo foi
-- salvo sem pontuacao passa batido.
--
-- Ja aconteceu uma vez: uma colaboradora ativa e uma ficha antiga dela no arquivo,
-- a ficha arquivada (desligada) sao a mesma pessoa, com um "L" a mais no
-- nome. Este gatilho passa a comparar so os digitos, entao os dois formatos colidem.
--
-- Os dados existentes NAO sao reescritos: normalizar 243 cadastros e mudanca de dado, e
-- fica para uma decisao sua. A comparacao normalizada ja fecha a porta para novos.
--
-- O gatilho abaixo checa os dois schemas. Levanta 23505 com a mesma mensagem do indice
-- para a tela continuar tratando o caso do jeito que ja trata.
--
-- `id <> NEW.id` e o que mantem a movimentacao funcionando: tanto arquivar quanto
-- reativar copiam a linha para o outro schema ANTES de apagar a origem, entao durante
-- alguns instantes o mesmo CPF existe dos dois lados — com o mesmo id.

CREATE OR REPLACE FUNCTION public.cpf_unico_nos_dois_schemas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, arquivo, pg_temp
AS $$
BEGIN
  -- Sem digito nenhum (nulo, vazio, ou so mascara "___.___.___-__") nao ha o que checar.
  IF NEW.cpf IS NULL OR regexp_replace(NEW.cpf, '[^0-9]', '', 'g') = '' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.employees e
              WHERE regexp_replace(e.cpf, '[^0-9]', '', 'g') = regexp_replace(NEW.cpf, '[^0-9]', '', 'g')
                AND e.id <> NEW.id)
     OR EXISTS (SELECT 1 FROM arquivo.employees a
              WHERE regexp_replace(a.cpf, '[^0-9]', '', 'g') = regexp_replace(NEW.cpf, '[^0-9]', '', 'g')
                AND a.id <> NEW.id) THEN
    RAISE EXCEPTION 'duplicate key value violates unique constraint "employees_cpf_unique"'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.cpf_unico_nos_dois_schemas() OWNER TO postgres;

DROP TRIGGER IF EXISTS employees_cpf_unico ON public.employees;
CREATE TRIGGER employees_cpf_unico
  BEFORE INSERT OR UPDATE OF cpf ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.cpf_unico_nos_dois_schemas();

DROP TRIGGER IF EXISTS employees_cpf_unico ON arquivo.employees;
CREATE TRIGGER employees_cpf_unico
  BEFORE INSERT OR UPDATE OF cpf ON arquivo.employees
  FOR EACH ROW EXECUTE FUNCTION public.cpf_unico_nos_dois_schemas();
