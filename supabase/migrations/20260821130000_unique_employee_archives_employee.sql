-- Um colaborador ocupa uma caixa só. Até aqui isso dependia apenas do delete+insert do app.
--
-- A versão anterior desta migration apagava as duplicatas antes de criar o índice. Isso
-- destruiria linhas legadas (a tabela tem `document_type`, hoje nunca preenchido pelo app,
-- mas presente no seed de arquivo morto) sem chance de recuperação. Em vez disso, o índice
-- só é criado quando não há duplicata; havendo, a migration avisa e não altera dado nenhum,
-- e a garantia continua sendo o delete+insert de src/lib/archiveBox.ts.

DO $$
DECLARE
  duplicados integer;
BEGIN
  SELECT count(*) INTO duplicados
  FROM (
    SELECT employee_id
    FROM public.employee_archives
    WHERE employee_id IS NOT NULL
    GROUP BY employee_id
    HAVING count(*) > 1
  ) d;

  IF duplicados > 0 THEN
    RAISE NOTICE 'employee_archives: % colaborador(es) com mais de uma caixa; índice UNIQUE não criado. Resolva as duplicatas e rode esta migration de novo.', duplicados;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS employee_archives_employee_unique
      ON public.employee_archives (employee_id);
  END IF;
END $$;
