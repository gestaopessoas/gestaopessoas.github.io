-- ROLLBACK: as 6 constraints criadas abaixo, uma a uma:
--   ALTER TABLE arquivo.<filha> DROP CONSTRAINT <nome>;
-- (as 36 linhas apagadas nao voltam — nao existe de onde)
--
-- Duas coisas: limpa as netas orfas e fecha a porta que as produz.
--
-- O QUE SAO AS ORFAS
--
-- Cada mudanca num colaborador grava uma linha de historico (a "capa": quem, quando,
-- qual campo) e duas linhas de valor (estava / ficou). Estas 36 sao linhas de VALOR
-- cuja capa nao existe mais em nenhum dos dois schemas: 15 mudancas de 5 pessoas
-- (Ativo -> Desligado, e duas datas de desligamento). Sem a capa nao ha o `id` que liga
-- o valor a pessoa e a data, entao nao ha o que recuperar — a informacao acabou.
--
-- Nao aparecem em tela nenhuma (as telas montam o historico pela capa e so entao
-- buscam os valores dela), mas sujam a auditoria e sao 0,05% da tabela.
--
-- POR QUE NASCERAM, E POR QUE NAO NASCEM MAIS
--
-- `CREATE TABLE ... (LIKE origem INCLUDING ALL)` NAO copia chave estrangeira. O schema
-- `arquivo` nasceu com ZERO — ou seja, apagar uma "mae" la nunca levou as filhas junto,
-- e mover so metade de um par nunca foi barrado por nada. Foi assim que reativar
-- colaborador (corrigido em 20260909100400) deixou valores para tras.
--
-- Espelhar as 6 FKs em cascata resolve estruturalmente: a partir daqui e o banco que
-- garante, nao a disciplina de quem escreve a proxima funcao.
--
-- DUAS DECISOES DENTRO DISTO
--
-- 1. DEFERRABLE INITIALLY DEFERRED e obrigatorio, nao cuidado extra. Dentro de
--    `mover_para_arquivo()` as filhas entram num laco sobre `pg_constraint`, em ordem
--    que o Postgres escolhe: `time_logs_history` pode chegar antes de `time_logs`.
--    Adiando a checagem para o commit, a ordem dentro da transacao deixa de importar.
--
-- 2. Nenhuma FK apontando para `arquivo.employees`. Seria o oposto do desejado: ao
--    reativar, a linha de `arquivo.employees` e apagada de proposito, e uma cascata
--    dali levaria junto `arquivo.employee_archives` — os dossies das passagens
--    anteriores, que o ADR 0008 manda preservar. As orfas observadas nasceram todas no
--    nivel neta, que e o que se fecha aqui.

-- 1. Limpeza. Roda antes das constraints: com elas no lugar, o INSERT das FKs falharia.
DELETE FROM arquivo.employee_history_value_entries v
WHERE NOT EXISTS (SELECT 1 FROM arquivo.employee_history h WHERE h.id = v.history_id)
  AND NOT EXISTS (SELECT 1 FROM public.employee_history  h WHERE h.id = v.history_id);

DELETE FROM public.employee_history_value_entries v
WHERE NOT EXISTS (SELECT 1 FROM public.employee_history  h WHERE h.id = v.history_id)
  AND NOT EXISTS (SELECT 1 FROM arquivo.employee_history h WHERE h.id = v.history_id);

-- 2. Espelha as FKs em cascata cuja mae NAO e employees.
DO $$
DECLARE r record; criadas integer := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT c.conname, cl.relname AS filha, a.attname AS col,
           ref.relname AS mae, refa.attname AS mae_col
    FROM pg_constraint c
    JOIN pg_class cl        ON cl.oid = c.conrelid
    JOIN pg_class ref       ON ref.oid = c.confrelid
    JOIN pg_attribute a     ON a.attrelid = c.conrelid  AND a.attnum = c.conkey[1]
    JOIN pg_attribute refa  ON refa.attrelid = c.confrelid AND refa.attnum = c.confkey[1]
    JOIN pg_namespace n     ON n.oid = cl.relnamespace
    WHERE c.contype = 'f' AND c.confdeltype = 'c' AND n.nspname = 'public'
      AND ref.relname <> 'employees'
      AND array_length(c.conkey, 1) = 1
      AND to_regclass('arquivo.' || quote_ident(cl.relname))  IS NOT NULL
      AND to_regclass('arquivo.' || quote_ident(ref.relname)) IS NOT NULL
  LOOP
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM pg_constraint x
      JOIN pg_class xc ON xc.oid = x.conrelid
      JOIN pg_namespace xn ON xn.oid = xc.relnamespace
      WHERE xn.nspname = 'arquivo' AND xc.relname = r.filha AND x.conname = r.conname);

    EXECUTE format(
      'ALTER TABLE arquivo.%I ADD CONSTRAINT %I FOREIGN KEY (%I)
         REFERENCES arquivo.%I(%I) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED',
      r.filha, r.conname, r.col, r.mae, r.mae_col);
    criadas := criadas + 1;
    RAISE NOTICE 'FK espelhada: arquivo.% -> arquivo.%', r.filha, r.mae;
  END LOOP;

  RAISE NOTICE 'total de FKs criadas no schema arquivo: %', criadas;
END $$;
