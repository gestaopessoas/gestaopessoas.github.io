-- ROLLBACK:
--   UPDATE public.employees SET role = 'ASSISTENTE ADMINISTRATIVO'
--    WHERE registration_number IN ('19755','19838','19307');
--   UPDATE public.employees SET role = 'MESTRE DE OBRAS'  WHERE registration_number = '19639';
--   UPDATE public.employees SET role = 'CARPINTEIRO'      WHERE registration_number = '19766';
--   UPDATE public.employees SET role = 'DIRETOR (OBRAS)'  WHERE registration_number = '4221';
--   UPDATE public.employees SET role = 'PSICÓLOGO'        WHERE registration_number = '4987';
--   UPDATE public.job_profiles SET title = 'ATENDENTE DE OBRA'  WHERE title = 'ATENDENTE DE OBRAS';
--   UPDATE public.employees    SET role  = 'ATENDENTE DE OBRA'  WHERE role  = 'ATENDENTE DE OBRAS';
--   UPDATE public.job_profiles SET title = 'MOTORISTA DE LOGÍSTICA (VEÍCULOS DE PEQUENO PORTE)'
--    WHERE title = 'MOTORISTA DE LOGÍSTICA';
--   UPDATE public.employees SET role = 'MOTORISTA DE LOGÍSTICA (VEÍCULOS DE PEQUENO PORTE)'
--    WHERE role = 'MOTORISTA DE LOGÍSTICA';
--   DELETE FROM public.job_profiles WHERE profile_code IN ('DIR-OPERACOES','PSIC-ORG');
--
-- Corrige o cargo de 9 colaboradores, conferido com a planilha de custos do RH.
-- Decisoes do Bruno em 2026-09-14, uma a uma.
--
-- DE ONDE VEM
--
-- A comparacao entre "Custos Geral 01092026.xlsx" (folha de 09/09/2026) e o sistema
-- achou 19 cargos divergentes. Sete grupos eram so abreviacao da planilha ("COORD.",
-- "AUX.") e ficam como estao. Estes sao os que a folha mostrou estarem errados AQUI.
--
-- A FOLHA CONFIRMOU TRES DELES
--
-- 1. AUXILIAR x ASSISTENTE ADMINISTRATIVO (3 pessoas). O sistema dizia ASSISTENTE, cuja
--    faixa comeca em 2.048,54. Os tres recebem 1.896,80, 1.896,80 e 1.626,20 — todos
--    DENTRO da faixa de AUXILIAR (1.626,20 a 2.544,29) e ABAIXO do piso de assistente.
--    Ninguem muda de salario; a referencia e que passa a bater com o pago.
--
-- 2. O caso do encarregado. O sistema dizia MESTRE DE OBRAS; ele recebe 3.510,84,
--    que e exatamente o CLT / Junior / Nivel V de ENCARREGADO CIVIL e NAO existe na
--    grade do mestre de obras. Era o unico dos 7 mestres fora da banda dos outros seis.
--
-- 3. O caso do psicologo. O sistema dizia PSICÓLOGO (teto 3.205,07); ele e PJ e
--    recebe 3.400,00, acima desse teto. PSICÓLOGO ORGANIZACIONAL ja existe na tabela
--    salarial, de 2.580,58 a 6.406,96, e e onde ele cabe.
--
-- OS OUTROS QUATRO
--
-- 4. matricula 19766: CARPINTEIRO -> PEDREIRO. Sem efeito em dinheiro, os dois
--    oficios pagam pela faixa de OFICIAL.
-- 5. matricula 4221: DIRETOR (OBRAS) -> DIRETOR DE OPERAÇÕES. Cargo novo no
--    catalogo, ja marcado fora da tabela salarial como o resto da diretoria.
-- 6. O atendente: ATENDENTE DE OBRA -> ATENDENTE DE OBRAS (plural).
-- 7. O motorista: cai o "(VEÍCULOS DE PEQUENO PORTE)" do nome.
--
-- Nos casos 6 e 7 o CATALOGO e renomeado junto, levando o vinculo com a faixa. Renomear
-- so a ficha deixaria as duas pessoas apontando para um cargo que nao existe mais, e
-- portanto sem salario de referencia.
--
-- SOBRE OS NOMES COM E SEM "(A)"
--
-- As migrations de 10/09 tiram o sufixo de genero: em producao ainda e "PSICÓLOGO(A)" e
-- "DIRETOR (OBRAS)". Cada UPDATE aqui aceita as DUAS grafias, para rodar tanto depois da
-- padronizacao quanto antes dela.

-- 1. auxiliar administrativo (3 pessoas)
UPDATE public.employees
   SET role = 'AUXILIAR ADMINISTRATIVO'
 WHERE registration_number IN ('19755', '19838',
                '19307')
   AND upper(role) LIKE 'ASSISTENTE ADMINISTRATIVO%';

-- 2. a matricula 3573 e encarregado, nao mestre de obras
UPDATE public.employees
   SET role = 'ENCARREGADO'
 WHERE registration_number = '19639'
   AND upper(role) LIKE 'MESTRE DE OBRAS%';

-- 3. Murilo paga pela faixa de psicologo organizacional, que ja existe
INSERT INTO public.job_profiles (id, profile_code, title)
SELECT gen_random_uuid(), 'PSIC-ORG', 'PSICÓLOGO ORGANIZACIONAL'
 WHERE NOT EXISTS (
   SELECT 1 FROM public.job_profiles WHERE upper(title) LIKE 'PSIC%ORGANIZACIONAL%');

UPDATE public.employees
   SET role = 'PSICÓLOGO ORGANIZACIONAL'
 WHERE registration_number = '4987'
   AND upper(role) LIKE 'PSIC%';

-- 4. Alcir e pedreiro
UPDATE public.employees
   SET role = 'PEDREIRO'
 WHERE registration_number = '19766'
   AND upper(role) LIKE 'CARPINTEIRO%';

-- 5. Rafael e diretor de operacoes
INSERT INTO public.job_profiles (id, profile_code, title, off_salary_table)
SELECT gen_random_uuid(), 'DIR-OPERACOES', 'DIRETOR DE OPERAÇÕES', true
 WHERE NOT EXISTS (
   SELECT 1 FROM public.job_profiles WHERE upper(title) = 'DIRETOR DE OPERAÇÕES');

UPDATE public.employees
   SET role = 'DIRETOR DE OPERAÇÕES'
 WHERE registration_number = '4221'
   AND upper(role) LIKE 'DIRETOR %(OBRAS)%';

-- 6. atendente de obras, no plural — catalogo junto, para o vinculo ir com o nome
UPDATE public.job_profiles
   SET title = 'ATENDENTE DE OBRAS'
 WHERE upper(title) = 'ATENDENTE DE OBRA'
   AND NOT EXISTS (SELECT 1 FROM public.job_profiles j2
                    WHERE upper(j2.title) = 'ATENDENTE DE OBRAS');

UPDATE public.employees  SET role = 'ATENDENTE DE OBRAS' WHERE upper(role) = 'ATENDENTE DE OBRA';
UPDATE arquivo.employees SET role = 'ATENDENTE DE OBRAS' WHERE upper(role) = 'ATENDENTE DE OBRA';

-- 7. motorista de logistica, sem o porte do veiculo
UPDATE public.job_profiles
   SET title = 'MOTORISTA DE LOGÍSTICA'
 WHERE upper(title) LIKE 'MOTORISTA DE LOGÍSTICA (VE%'
   AND NOT EXISTS (SELECT 1 FROM public.job_profiles j2
                    WHERE upper(j2.title) = 'MOTORISTA DE LOGÍSTICA');

UPDATE public.employees
   SET role = 'MOTORISTA DE LOGÍSTICA'
 WHERE upper(role) LIKE 'MOTORISTA DE LOGÍSTICA (VE%';

UPDATE arquivo.employees
   SET role = 'MOTORISTA DE LOGÍSTICA'
 WHERE upper(role) LIKE 'MOTORISTA DE LOGÍSTICA (VE%';

DO $$
DECLARE
  faltou text;
  sem_faixa integer;
  quantos integer;
BEGIN
  -- Cada pessoa tem que ter saido do cargo antigo. Se alguma nao mudou, e porque o nome
  -- no banco nao e o esperado — e melhor a migration parar do que mentir que arrumou.
  SELECT string_agg(x.quem, ', ') INTO faltou FROM (
    SELECT registration_number AS quem FROM public.employees
     WHERE registration_number IN ('19755', '19838',
                    '19307', '19639',
                    '19766', '4221',
                    '4987')
       AND role NOT IN ('AUXILIAR ADMINISTRATIVO', 'ENCARREGADO', 'PEDREIRO',
                        'DIRETOR DE OPERAÇÕES', 'PSICÓLOGO ORGANIZACIONAL')) x;

  IF faltou IS NOT NULL THEN
    RAISE EXCEPTION 'Nao consegui corrigir o cargo de: %', faltou;
  END IF;

  SELECT count(*) INTO quantos FROM public.employees
   WHERE role IN ('ATENDENTE DE OBRAS', 'MOTORISTA DE LOGÍSTICA');
  IF quantos <> 2 THEN
    RAISE EXCEPTION 'Esperava 2 pessoas nos cargos renomeados, achei %', quantos;
  END IF;

  -- Ninguem pode ter ficado sem faixa por causa desta migration.
  SELECT count(*) INTO sem_faixa
    FROM (SELECT EXISTS (
                   SELECT 1 FROM public.salary_table s
                    WHERE s.role_name = coalesce(
                            (SELECT j.salary_role FROM public.job_profiles j
                              WHERE j.title = e.role AND j.salary_role IS NOT NULL LIMIT 1),
                            e.role)) AS tem,
                 coalesce((SELECT j.off_salary_table FROM public.job_profiles j
                            WHERE j.title = e.role LIMIT 1), false) AS fora
            FROM public.employees e
           WHERE e.role IS NOT NULL AND btrim(e.role) <> '') f
   WHERE NOT tem AND NOT fora;

  IF sem_faixa > 0 THEN
    RAISE EXCEPTION '% colaborador(es) ficaram sem faixa salarial', sem_faixa;
  END IF;

  RAISE NOTICE 'Cargos conferidos com a folha: 9 pessoas corrigidas, 0 sem faixa.';
END $$;
