-- ROLLBACK:
--   UPDATE public.employees  SET role = 'ASSISTENTE DE ORÇAMENTOS' WHERE role = 'ASSISTENTE DE ORÇAMENTO';
--   UPDATE arquivo.employees SET role = 'ASSISTENTE DE ORÇAMENTOS' WHERE role = 'ASSISTENTE DE ORÇAMENTO';
--   UPDATE public.job_profiles SET salary_role = NULL
--    WHERE title IN ('INSTALADOR HIDRÁULICO', 'COORDENADOR COMERCIAL');
--
-- Liga ao salario os cargos que ficaram de fora. Decisoes do Bruno em 2026-09-11.
--
-- Depois de importar a planilha do RH sobraram 45 colaboradores sem faixa. Destes, tres
-- casos eram so o nome nao casando com a planilha — nao falta de faixa.
--
-- 1. ASSISTENTE DE ORÇAMENTOS (3 pessoas)
--
-- Erro de digitacao puro: a planilha chama "ASSISTENTE DE ORÇAMENTO", no singular. Aqui
-- o cargo e RENOMEADO, porque sao o mesmo cargo escrito de dois jeitos — exatamente o
-- tipo de divergencia que a padronizacao de 2026-09-10 fechou.
--
-- (A planilha mistura singular e plural entre cargos diferentes: existe tambem
-- "SUPERVISOR DE ORÇAMENTOS". Nao e incoerencia a corrigir, sao cargos distintos.)
--
-- 2. COORDENADOR COMERCIAL (4 pessoas)
--
-- A planilha chama "COORDENADOR COMERCIAL (CARGO COMISSIONADO)". Aqui NAO se renomeia: o
-- "(CARGO COMISSIONADO)" e uma observacao sobre a forma de remuneracao, nao o nome do
-- cargo de ninguem. Carimbar isso na ficha de 4 pessoas seria pior que o problema.
--
-- Usa-se `salary_role`, o mesmo mecanismo dos oficios: "paga pela faixa de".
--
-- 3. INSTALADOR HIDRÁULICO (3 pessoas)
--
-- Bruno confirmou: e oficio, paga como OFICIAL — igual a pedreiro, encanador,
-- carpinteiro, pintor e ferreiro armador.

-- 1. o plural que nao existia
UPDATE public.employees
   SET role = 'ASSISTENTE DE ORÇAMENTO'
 WHERE role = 'ASSISTENTE DE ORÇAMENTOS';

UPDATE arquivo.employees
   SET role = 'ASSISTENTE DE ORÇAMENTO'
 WHERE role = 'ASSISTENTE DE ORÇAMENTOS';

UPDATE public.job_profiles
   SET title = 'ASSISTENTE DE ORÇAMENTO'
 WHERE title = 'ASSISTENTE DE ORÇAMENTOS'
   AND NOT EXISTS (SELECT 1 FROM public.job_profiles j WHERE j.title = 'ASSISTENTE DE ORÇAMENTO');

DELETE FROM public.job_profiles
 WHERE title = 'ASSISTENTE DE ORÇAMENTOS';

-- 2 e 3. paga pela faixa de outro cargo
UPDATE public.job_profiles
   SET salary_role = 'COORDENADOR COMERCIAL (CARGO COMISSIONADO)'
 WHERE title = 'COORDENADOR COMERCIAL';

UPDATE public.job_profiles
   SET salary_role = 'OFICIAL', is_operational = true
 WHERE title = 'INSTALADOR HIDRÁULICO';

-- O cargo precisa existir no cadastro para poder apontar para a faixa.
INSERT INTO public.job_profiles (id, profile_code, title, is_operational, salary_role)
SELECT gen_random_uuid(), 'OFICIO-INST-HID', 'INSTALADOR HIDRÁULICO', true, 'OFICIAL'
 WHERE NOT EXISTS (SELECT 1 FROM public.job_profiles WHERE title = 'INSTALADOR HIDRÁULICO');

INSERT INTO public.job_profiles (id, profile_code, title, salary_role)
SELECT gen_random_uuid(), 'COORD-COMERCIAL', 'COORDENADOR COMERCIAL', 'COORDENADOR COMERCIAL (CARGO COMISSIONADO)'
 WHERE NOT EXISTS (SELECT 1 FROM public.job_profiles WHERE title = 'COORDENADOR COMERCIAL');

DO $$
DECLARE com_faixa integer; sem_faixa integer; minusculas integer;
BEGIN
  -- Toda lista de cargo em MAIUSCULA, sem excecao. Decisao do Bruno em 2026-09-10.
  SELECT (SELECT count(*) FROM public.salary_table WHERE role_name <> upper(role_name))
       + (SELECT count(*) FROM public.job_profiles WHERE title <> upper(title))
       + (SELECT count(*) FROM public.employees_todos
           WHERE role IS NOT NULL AND btrim(role) <> '' AND role <> upper(role))
    INTO minusculas;

  IF minusculas > 0 THEN
    RAISE EXCEPTION 'Ha % nome(s) de cargo fora da caixa alta', minusculas;
  END IF;

  SELECT count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM public.salary_table s WHERE s.role_name = f.cargo_da_faixa)),
         count(*) FILTER (WHERE NOT EXISTS (
           SELECT 1 FROM public.salary_table s WHERE s.role_name = f.cargo_da_faixa))
    INTO com_faixa, sem_faixa
    FROM (SELECT coalesce((SELECT j.salary_role FROM public.job_profiles j
                            WHERE j.title = e.role AND j.salary_role IS NOT NULL LIMIT 1),
                          e.role) AS cargo_da_faixa
            FROM public.employees e
           WHERE e.role IS NOT NULL AND btrim(e.role) <> '') f;

  RAISE NOTICE 'Colaboradores com faixa: % | sem faixa: % (eram 127 antes da planilha).',
    com_faixa, sem_faixa;
END $$;
