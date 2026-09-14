-- ROLLBACK: nao ha volta automatica — renomeia faixa e cargo, e apaga duplicata de
--   catalogo. Restaurar do dump se precisar.
--
-- Junta os cargos que eram a mesma coisa escrita de outro jeito. Decisoes do Bruno em
-- 2026-09-11, uma a uma.
--
-- 1. COORDENADOR COMERCIAL — cai o "(CARGO COMISSIONADO)"
--
-- A observacao sobre forma de remuneracao sai do NOME da faixa. Com os dois nomes
-- iguais, o desvio `salary_role` deixa de ser necessario.
--
-- 2. COORDENADOR DE PLANEJAMENTO — cai o "E CONTROLADORIA"
--
-- 3. ESTAGIARIO — escolaridade vira dimensao, nao tres cargos
--
-- A planilha traz ESTAGIÁRIO - ENSINO MÉDIO, - TÉCNICO e - SUPERIOR. Os tres pagam
-- EXATAMENTE o mesmo em todos os 12 pontos (CLT e PJ, Niveis I a IV) — conferido antes
-- de juntar. Viram um cargo so, com a escolaridade na coluna `seniority`, que e a
-- dimensao que cruza com os niveis (o mesmo lugar onde moram Junior/Pleno/Senior).
--
-- Como os valores eram identicos, juntar produz linhas repetidas: elas sao removidas
-- aqui mesmo, senao a tela passaria a acusar "repetidas" num cargo recem-arrumado.
--
-- ESTAGIÁRIO ENGENHARIA CIVIL CANTEIRO passa a pagar pela faixa de ESTAGIÁRIO. Nao ha
-- risco de valor: estagio paga o mesmo em qualquer das tres escolaridades.
--
-- 4. SERVIÇOS GERAIS = AUXILIAR DE SERVIÇOS GERAIS
--
-- 5. TÉCNICO EM EDIFICAÇÕES — obras e sede pagam diferente
--
-- Regra do Bruno: SETOR OBRAS atua na obra, SETOR TÉCNICO fica na sede. As duas faixas
-- existem e NAO tem o mesmo valor (2.316,87 contra 2.580,58 na entrada), entao nao da
-- para juntar. A unica pessoa no cargo hoje esta na Sede, setor TÉCNICO — o cargo
-- generico passa a pagar pela faixa do SETOR TÉCNICO.
-- ATENCAO: quando entrar um tecnico em edificacoes de OBRA, ele precisa ser cadastrado
-- como "TÉCNICO EM EDIFICAÇÕES (SETOR OBRAS)", senao recebe a faixa da sede.
--
-- O QUE NAO ENTRA AQUI
--
-- ENCARREGADO fica sem faixa de proposito. ENCARREGADO CIVIL e ENCARREGADO DE OBRAS
-- cobrem as mesmas 30 combinacoes com valores diferentes (2.580,58 contra 3.421,05 na
-- entrada — 33% de diferenca). "Sao os dois" nao pode virar uma faixa so: o
-- preenchimento automatico escolheria um dos dois sem criterio, no salario de uma
-- pessoa real. Fica sem faixa ate a diferenciacao que o Bruno adiou.

-- 1. COORDENADOR COMERCIAL
UPDATE public.salary_table
   SET role_name = 'COORDENADOR COMERCIAL'
 WHERE role_name = 'COORDENADOR COMERCIAL (CARGO COMISSIONADO)';

UPDATE public.job_profiles
   SET salary_role = NULL
 WHERE title = 'COORDENADOR COMERCIAL';

-- 2. COORDENADOR DE PLANEJAMENTO
UPDATE public.salary_table
   SET role_name = 'COORDENADOR DE PLANEJAMENTO'
 WHERE role_name = 'COORDENADOR DE PLANEJAMENTO E CONTROLADORIA';

DELETE FROM public.job_profiles j
 WHERE j.title = 'COORDENADOR DE PLANEJAMENTO E CONTROLADORIA'
   AND NOT EXISTS (SELECT 1 FROM public.job_openings o WHERE o.profile_id = j.id)
   AND NOT EXISTS (SELECT 1 FROM public.job_requests r WHERE r.profile_id = j.id);

-- 3. ESTAGIÁRIO
UPDATE public.salary_table
   SET role_name = 'ESTAGIÁRIO',
       seniority = CASE
         WHEN role_name LIKE '%ENSINO MÉDIO%' THEN 'Ensino Médio'
         WHEN role_name LIKE '%TÉCNICO%'      THEN 'Técnico'
         ELSE 'Superior'
       END
 WHERE role_name LIKE 'ESTAGIÁRIO - %';

-- as repetidas que o merge produziu (mesmo regime, nivel, escolaridade e valor)
DELETE FROM public.salary_table a
 USING public.salary_table b
 WHERE a.role_name = 'ESTAGIÁRIO' AND b.role_name = 'ESTAGIÁRIO'
   AND a.id > b.id
   AND a.modality = b.modality
   AND coalesce(a.level, '') = coalesce(b.level, '')
   AND coalesce(a.seniority, '') = coalesce(b.seniority, '')
   AND a.salary IS NOT DISTINCT FROM b.salary;

-- catalogo tinha ESTAGIÁRIO duas vezes; fica o cadastro antigo (C-0031)
DELETE FROM public.job_profiles j
 WHERE j.title = 'ESTAGIÁRIO' AND j.profile_code <> 'C-0031'
   AND NOT EXISTS (SELECT 1 FROM public.job_openings o WHERE o.profile_id = j.id)
   AND NOT EXISTS (SELECT 1 FROM public.job_requests r WHERE r.profile_id = j.id);

UPDATE public.job_profiles
   SET salary_role = 'ESTAGIÁRIO'
 WHERE title = 'ESTAGIÁRIO ENGENHARIA CIVIL CANTEIRO';

-- 4. SERVIÇOS GERAIS
UPDATE public.employees
   SET role = 'AUXILIAR DE SERVIÇOS GERAIS'
 WHERE role = 'SERVIÇOS GERAIS';

UPDATE arquivo.employees
   SET role = 'AUXILIAR DE SERVIÇOS GERAIS'
 WHERE role = 'SERVIÇOS GERAIS';

DELETE FROM public.job_profiles j
 WHERE j.title = 'SERVIÇOS GERAIS'
   AND NOT EXISTS (SELECT 1 FROM public.job_openings o WHERE o.profile_id = j.id)
   AND NOT EXISTS (SELECT 1 FROM public.job_requests r WHERE r.profile_id = j.id);

-- 5. TÉCNICO EM EDIFICAÇÕES
UPDATE public.job_profiles
   SET salary_role = 'TÉCNICO EM EDIFICAÇÕES (SETOR TÉCNICO)'
 WHERE title = 'TÉCNICO EM EDIFICAÇÕES';

DO $$
DECLARE estagio integer; repetidas integer; com_faixa integer; sem_faixa integer;
BEGIN
  SELECT count(*) INTO estagio FROM public.salary_table WHERE role_name LIKE 'ESTAGIÁRIO - %';
  IF estagio > 0 THEN
    RAISE EXCEPTION 'Sobraram % linhas de ESTAGIÁRIO com escolaridade no nome', estagio;
  END IF;

  SELECT count(*) INTO repetidas FROM (
    SELECT 1 FROM public.salary_table WHERE role_name = 'ESTAGIÁRIO'
     GROUP BY modality, coalesce(level, ''), coalesce(seniority, '') HAVING count(*) > 1) x;
  IF repetidas > 0 THEN
    RAISE EXCEPTION 'ESTAGIÁRIO ficou com % combinacao(oes) repetida(s)', repetidas;
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
