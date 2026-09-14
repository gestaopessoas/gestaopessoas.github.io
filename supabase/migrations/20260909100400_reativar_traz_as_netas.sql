-- ROLLBACK: reaplique o corpo de public.reativar_colaborador(uuid) de
--           20260908120100_arquivo_morto_funcoes.sql
--
-- Reativar trazia a mae e deixava as netas no arquivo.
--
-- O laco de `reativar_colaborador()` percorria so as filhas diretas de `employees`.
-- `employee_history` voltava para `public`, mas `employee_history_value_entries` ficava
-- em `arquivo`, apontando para um `history_id` que agora mora em outro schema. Medido
-- num caso real: 15 historicos voltaram, 33 linhas de valor ficaram para tras.
--
-- Como o schema `arquivo` nao tem chave estrangeira (o `LIKE ... INCLUDING ALL` nao
-- copia FK), nada reclamava. E `public.employee_history_value_entries` tem
-- `ON DELETE CASCADE` para `public.employee_history`: apagar aquele historico depois
-- NAO levaria as 33 junto — viravam orfas permanentes.
--
-- Efeito visivel: a ficha do reativado mostra as linhas de historico com os valores
-- "de X para Y" em branco, em qualquer tela que leia a tabela em vez da view `_todos`.
--
-- A ordem importa: as netas sao copiadas ANTES de apagar as maes do arquivo, porque e a
-- mae ainda em `arquivo` que diz quais netas pertencem a esta pessoa. E os DELETE
-- descem na ordem inversa — netas, filhas, employees.
--
-- ponytail: dois niveis, igual ao caminho de arquivamento. O grafo de cascata hoje tem
-- exatamente dois (conferido com CTE recursiva). Se um dia nascer uma bisneta, os dois
-- lados viram um laco ate convergir, como ja e feito na 20260908210000.

CREATE OR REPLACE FUNCTION public.reativar_colaborador(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, arquivo, pg_temp
AS $fn$
DECLARE r record; neta record; existe boolean;
BEGIN
  IF NOT public.can_access('arquivo_morto', 'edit') THEN
    RAISE EXCEPTION 'Sem permissao para reativar colaboradores';
  END IF;

  SELECT EXISTS (SELECT 1 FROM arquivo.employees WHERE id = p_id) INTO existe;

  IF NOT existe THEN
    -- Ja esta no quadro atual: so corrige o status (caso do ativo com caixa).
    UPDATE public.employees SET status = 'Ativo' WHERE id = p_id;
    RETURN FOUND;
  END IF;

  -- employees primeiro: as filhas tem FK apontando para ele.
  INSERT INTO public.employees SELECT * FROM arquivo.employees WHERE id = p_id;
  UPDATE public.employees SET status = 'Ativo' WHERE id = p_id;

  FOR r IN
    SELECT DISTINCT cl.relname AS t, a.attname AS col, cl.oid AS t_oid
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.confrelid = 'public.employees'::regclass AND c.confdeltype = 'c'
      AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='arquivo' AND tablename=cl.relname)
      -- employee_archives fica no arquivo: o dossie da passagem anterior e historico.
      AND cl.relname <> 'employee_archives'
  LOOP
    EXECUTE format('INSERT INTO public.%I SELECT x.* FROM arquivo.%I x WHERE x.%I = $1', r.t, r.t, r.col)
      USING p_id;

    -- Netas desta filha, enquanto a mae ainda esta em `arquivo` para identifica-las.
    FOR neta IN
      SELECT cl.relname AS t, a.attname AS col, refa.attname AS mae_col
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      JOIN pg_attribute refa ON refa.attrelid = c.confrelid AND refa.attnum = c.confkey[1]
      WHERE c.contype = 'f' AND c.confdeltype = 'c' AND c.confrelid = r.t_oid
        AND to_regclass('arquivo.' || quote_ident(cl.relname)) IS NOT NULL
    LOOP
      EXECUTE format(
        'INSERT INTO public.%I SELECT x.* FROM arquivo.%I x
           WHERE x.%I IN (SELECT m.%I FROM arquivo.%I m WHERE m.%I = $1)
           ON CONFLICT DO NOTHING',
        neta.t, neta.t, neta.col, neta.mae_col, r.t, r.col) USING p_id;

      EXECUTE format(
        'DELETE FROM arquivo.%I x
           WHERE x.%I IN (SELECT m.%I FROM arquivo.%I m WHERE m.%I = $1)',
        neta.t, neta.col, neta.mae_col, r.t, r.col) USING p_id;
    END LOOP;

    EXECUTE format('DELETE FROM arquivo.%I WHERE %I = $1', r.t, r.col) USING p_id;
  END LOOP;

  DELETE FROM arquivo.employees WHERE id = p_id;
  RETURN true;
END; $fn$;

ALTER FUNCTION public.reativar_colaborador(uuid) OWNER TO postgres;
