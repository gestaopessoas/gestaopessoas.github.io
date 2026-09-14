-- ROLLBACK: nao ha volta automatica, mas nada se perde — as linhas apagadas eram copias
--   identicas de linhas que continuam la.
--
-- Tira as ultimas linhas repetidas da tabela salarial.
--
-- AUXILIAR DE SERVIÇOS GERAIS tinha cada combinacao duas vezes, com o MESMO valor. Nao
-- muda salario nenhum: repetida com valor igual nao e conflito, o preenchimento
-- automatico acha o mesmo numero de qualquer lado. O problema e que 10 linhas mortas
-- ficam no meio da tela e escondem o que importa.
--
-- Apaga so onde cargo, regime, nivel, senioridade E valor sao identicos, mantendo uma.

DELETE FROM public.salary_table a
 USING public.salary_table b
 WHERE a.id > b.id
   AND a.role_name = b.role_name
   AND a.modality = b.modality
   AND coalesce(a.level, '') = coalesce(b.level, '')
   AND coalesce(a.seniority, '') = coalesce(b.seniority, '')
   AND a.salary IS NOT DISTINCT FROM b.salary
   AND a.salary_experience IS NOT DISTINCT FROM b.salary_experience
   AND a.salary_after_probation IS NOT DISTINCT FROM b.salary_after_probation;

DO $$
DECLARE repetidas integer; conflitos integer; total integer;
BEGIN
  SELECT coalesce(sum(n - 1), 0) INTO repetidas
    FROM (SELECT count(*) AS n FROM public.salary_table
           GROUP BY role_name, modality, coalesce(level, ''), coalesce(seniority, ''), salary
         ) y WHERE n > 1;

  SELECT count(*) INTO conflitos FROM (
    SELECT 1 FROM public.salary_table WHERE uses_level
     GROUP BY role_name, modality, coalesce(level, ''), coalesce(seniority, '')
    HAVING count(DISTINCT salary) > 1) x;

  IF repetidas > 0 OR conflitos > 0 THEN
    RAISE EXCEPTION 'Sobraram % repetida(s) e % conflito(s)', repetidas, conflitos;
  END IF;

  SELECT count(*) INTO total FROM public.salary_table;
  RAISE NOTICE 'Tabela salarial: % linhas, 0 conflito, 0 repetida.', total;
END $$;
