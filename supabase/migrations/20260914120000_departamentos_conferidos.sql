-- ROLLBACK:
--   UPDATE public.departments SET name = 'RH' WHERE name = 'RECURSOS HUMANOS';
--   -- os demais UPDATEs nao tem volta automatica; restaurar do dump se precisar.
--
-- Departamentos conferidos com a folha de custos. Decisoes do Bruno em 2026-09-14.
--
-- A conferencia vira aviso (RAISE NOTICE) em banco sem cadastro, e continua reprovando
-- (RAISE EXCEPTION) onde ha colaborador cadastrado (issue #83).
--
-- 1. O SISTEMA SE CONTRADIZIA EM 12 PESSOAS
--
-- A ficha guarda a classificacao em DOIS lugares: a coluna de texto `department` e o
-- vinculo `department_id`. Em 12 colaboradores o texto dizia "Indireto" e o vinculo
-- dizia DIRETO. A folha de custos concorda com o vinculo nos 12 casos — duas fontes
-- independentes contra uma. Vence o vinculo.
--
-- Aqui NAO se escolhe um dos dois por gosto: o texto passa a ser copia do vinculo, que e
-- o dado que a tela usa e o unico com integridade garantida por chave estrangeira.
--
-- 2. QUATRO PESSOAS VAO PARA A CLASSIFICACAO
--
-- As matriculas 19019, 19456, 19905 e 19926 tinham departamento real no vinculo (APOIO, ENGENHARIA (OBRAS)) e
-- classificacao na folha. O Bruno decidiu pela folha.
--
-- O departamento ENGENHARIA (OBRAS) fica VAZIO depois disto — as duas mulheres da engenharia eram as
-- duas unicas. Nao se perde onde elas trabalham: o campo `setor` continua dizendo
-- "Engenharia em obras" e "Engenharia". O cadastro do departamento vazio fica, para o
-- caso de voltar a ser usado.
--
-- 3. RH VIRA RECURSOS HUMANOS
--
-- Existiam RH e GESTÃO DE PESSOAS como departamentos diferentes. Nao sao o mesmo: o
-- Bruno confirmou que GP e Gestao de Pessoas e RH e Recursos Humanos, e pediu os dois
-- por extenso. Os dois ficam; so a sigla some.
--
-- O QUE NAO ENTRA AQUI, DE PROPOSITO
--
-- 205 dos 293 ativos tem DIRETO ou INDIRETO como departamento, em vez do departamento
-- real. A tabela `departments` mistura tres coisas: departamento, classificacao de custo
-- e apelido (DAGOBERTO/LD, GESTOR, JOVEM APRENDIZ/COTAS). O Bruno decidiu deixar como
-- esta por ora. Fica registrado.

-- 1. o texto passa a copiar o vinculo onde os dois se contradizem
UPDATE public.employees e
   SET department = initcap(d.name)
  FROM public.departments d
 WHERE d.id = e.department_id
   AND upper(coalesce(e.department, '')) IN ('DIRETO', 'INDIRETO')
   AND upper(d.name) IN ('DIRETO', 'INDIRETO')
   AND upper(e.department) <> upper(d.name);

-- 2. os quatro que vao para a classificacao da folha
UPDATE public.employees
   SET department_id = (SELECT id FROM public.departments WHERE name = 'INDIRETO'),
       department = 'Indireto'
 WHERE registration_number IN ('19019', '19905', '19926');

UPDATE public.employees
   SET department_id = (SELECT id FROM public.departments WHERE name = 'DIRETO'),
       department = 'Direto'
 WHERE registration_number = '19456';

-- 3. a sigla vira nome por extenso
UPDATE public.departments
   SET name = 'RECURSOS HUMANOS'
 WHERE name = 'RH'
   AND NOT EXISTS (SELECT 1 FROM public.departments d2 WHERE d2.name = 'RECURSOS HUMANOS');

UPDATE public.employees e
   SET department = initcap(d.name)
  FROM public.departments d
 WHERE d.id = e.department_id
   AND d.name = 'RECURSOS HUMANOS'
   AND coalesce(e.department, '') = 'RH';

DO $$
DECLARE
  contradiz integer; quatro integer; tem_rh integer;
  sem_cadastro boolean := NOT EXISTS (SELECT 1 FROM public.employees LIMIT 1);
BEGIN
  SELECT count(*) INTO contradiz
    FROM public.employees e
    JOIN public.departments d ON d.id = e.department_id
   WHERE upper(coalesce(e.department, '')) IN ('DIRETO', 'INDIRETO')
     AND upper(d.name) IN ('DIRETO', 'INDIRETO')
     AND upper(e.department) <> upper(d.name);

  IF contradiz > 0 THEN
    IF sem_cadastro THEN
      RAISE NOTICE 'Ainda ha % ficha(s) com texto e vinculo se contradizendo; banco sem cadastro, conferencia pulada.', contradiz;
    ELSE
      RAISE EXCEPTION 'Ainda ha % ficha(s) com texto e vinculo se contradizendo', contradiz;
    END IF;
  END IF;

  SELECT count(*) INTO quatro
    FROM public.employees e
    JOIN public.departments d ON d.id = e.department_id
   WHERE e.registration_number IN ('19019', '19905',
                    '19926', '19456')
     AND upper(d.name) IN ('DIRETO', 'INDIRETO');

  IF quatro <> 4 THEN
    IF sem_cadastro THEN
      RAISE NOTICE 'Esperava as 4 pessoas na classificacao, achei %; banco sem cadastro, conferencia pulada.', quatro;
    ELSE
      RAISE EXCEPTION 'Esperava as 4 pessoas na classificacao, achei %', quatro;
    END IF;
  END IF;

  SELECT count(*) INTO tem_rh FROM public.departments WHERE name = 'RH';
  IF tem_rh > 0 THEN
    IF sem_cadastro THEN
      RAISE NOTICE 'O departamento RH continua existindo; banco sem cadastro, conferencia pulada.';
    ELSE
      RAISE EXCEPTION 'O departamento RH continua existindo';
    END IF;
  END IF;

  RAISE NOTICE 'Departamentos conferidos: 0 contradicao, 4 pessoas na classificacao, RH por extenso.';
END $$;
