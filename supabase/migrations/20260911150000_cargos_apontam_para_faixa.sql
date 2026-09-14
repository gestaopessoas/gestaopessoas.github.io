-- ROLLBACK:
--   UPDATE public.job_profiles SET salary_role = NULL
--    WHERE title IN ('SERVENTE', 'ATENDENTE DE OBRA', 'AUXILIAR DE CONTROLADORIA',
--                    'COORDENADOR DE NOVOS NEGÓCIOS', 'COORDENADOR DE SMS',
--                    'SUPERVISOR TÉCNICO');
--
-- Aponta os cargos restantes para a faixa que o Bruno indicou em 2026-09-11.
--
-- Tudo aqui e "paga como": nao renomeia cargo de ninguem, nao apaga faixa, e uma linha
-- de UPDATE desfaz. A partir desta rodada a tela tambem deixa mudar isso sem migration.
--
-- ATENCAO — SERVENTE MUDA DE PATAMAR, E SAO 48 PESSOAS
--
-- A planilha do RH poe "Servente" na MESMA banda de Auxiliar de Servicos Gerais
-- (1.626,20 CLT no Nivel I). O Bruno determinou que servente e MEIO OFICIAL, que e a
-- banda de cima (2.048,54 CLT no Nivel I) — cerca de 26% acima, em 48 colaboradores.
--
-- O que isso muda HOJE: so a faixa de referencia que a ficha sugere e que a tela de
-- tabela salarial mostra. Nenhum salario ja gravado em colaborador e alterado por esta
-- migration. Mas a divergencia com a planilha do RH e real e fica registrada aqui.
--
-- SUPERVISOR TÉCNICO
--
-- Nao existe faixa chamada so "SUPERVISOR" na planilha. Existem tres — SUPERVISOR
-- ADMINISTRATIVO, DE FINANÇAS e DE ORÇAMENTOS — e as tres pagam EXATAMENTE o mesmo nas
-- 30 combinacoes (conferido antes de escolher). Aponta para a ADMINISTRATIVO por ser a
-- generica das tres; o valor seria identico em qualquer uma.

UPDATE public.job_profiles SET salary_role = 'MEIO OFICIAL'
 WHERE title = 'SERVENTE';

UPDATE public.job_profiles SET salary_role = 'AUXILIAR DE SERVIÇOS GERAIS'
 WHERE title = 'ATENDENTE DE OBRA';

UPDATE public.job_profiles SET salary_role = 'AUXILIAR ADMINISTRATIVO'
 WHERE title = 'AUXILIAR DE CONTROLADORIA';

UPDATE public.job_profiles SET salary_role = 'COORDENADOR'
 WHERE title IN ('COORDENADOR DE NOVOS NEGÓCIOS', 'COORDENADOR DE SMS');

UPDATE public.job_profiles SET salary_role = 'SUPERVISOR ADMINISTRATIVO'
 WHERE title = 'SUPERVISOR TÉCNICO';

-- Toda faixa apontada precisa existir, senao o cargo continua sem salario e ninguem ve.
DO $$
DECLARE quebrado text; com_faixa integer; sem_faixa integer;
BEGIN
  SELECT string_agg(j.title || ' -> ' || j.salary_role, ', ')
    INTO quebrado
    FROM public.job_profiles j
   WHERE j.salary_role IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.salary_table s WHERE s.role_name = j.salary_role);

  IF quebrado IS NOT NULL THEN
    RAISE EXCEPTION 'Cargo apontando para faixa que nao existe: %', quebrado;
  END IF;

  SELECT count(*) FILTER (WHERE tem OR f.fora),
         count(*) FILTER (WHERE NOT tem AND NOT f.fora)
    INTO com_faixa, sem_faixa
    FROM (SELECT EXISTS (
                   SELECT 1 FROM public.salary_table s
                    WHERE s.role_name = coalesce(
                            (SELECT j.salary_role FROM public.job_profiles j
                              WHERE j.title = e.role AND j.salary_role IS NOT NULL LIMIT 1),
                            e.role)) AS tem,
                 coalesce((SELECT j.off_salary_table FROM public.job_profiles j
                            WHERE j.title = e.role LIMIT 1), false) AS fora
            FROM public.employees e
           WHERE e.role IS NOT NULL AND btrim(e.role) <> '') f;

  RAISE NOTICE 'Colaboradores resolvidos: % | ainda sem faixa: %.', com_faixa, sem_faixa;
END $$;
