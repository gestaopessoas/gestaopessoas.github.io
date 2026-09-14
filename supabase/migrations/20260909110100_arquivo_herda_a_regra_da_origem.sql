-- ROLLBACK: para cada tabela T do schema arquivo:
--   DROP POLICY arquivo_select ON arquivo.T;
--   CREATE POLICY arquivo_select ON arquivo.T FOR SELECT TO authenticated
--     USING (public.can_access('colaboradores','view') OR public.can_access('arquivo_morto','view'));
--
-- As tabelas do arquivo estavam mais frouxas que as originais.
--
-- Quando o arquivo morto foi separado, TODA tabela espelho recebeu a mesma policy
-- generica: `can_access('colaboradores','view') OR can_access('arquivo_morto','view')`.
-- So que as originais em `public` exigem modulos DIFERENTES — custo de pessoal pede
-- `salarios`, ponto pede `ponto`, uniforme pede `uniformes`, e por ai. Resultado: quem
-- tinha acesso a Colaboradores enxergava, do lado do arquivo, dado que a tela dele
-- nunca mostraria. Mesmo achado da auditoria de 2026-07-30, repetido.
--
-- Duas dessas tabelas ja eram alcancaveis pela API: `employee_archives_todos` e
-- `benefit_audit_log_entries_todos` sao views com `security_invoker`, entao o furo do
-- espelho valia de verdade, nao era teorico.
--
-- Aqui a policy do espelho passa a ser exatamente o OR das policies de LEITURA da
-- origem. Fiel, nao inventada: onde a origem e aberta (`employee_history` tem policy
-- `true`), o espelho fica aberto tambem — a decisao de apertar aquilo e outra conversa,
-- e escondida aqui viraria mudanca silenciosa de comportamento.
--
-- Criterio das policies consideradas: permissivas, que valham para SELECT (`r` ou `*`),
-- concedidas a `authenticated` ou a PUBLIC. As `*` com expressao `false` sao as de
-- bloqueio de `anon` — num OR nao somam nada, e ficam de fora.

DO $$
DECLARE
  t record;
  expr text;
  apertadas integer := 0;
BEGIN
  FOR t IN
    SELECT c.relname AS tabela
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'arquivo' AND c.relkind = 'r'
      AND to_regclass('public.' || quote_ident(c.relname)) IS NOT NULL
    ORDER BY 1
  LOOP
    SELECT string_agg('(' || pg_get_expr(p.polqual, p.polrelid) || ')', ' OR ')
      INTO expr
    FROM pg_policy p
    WHERE p.polrelid = to_regclass('public.' || quote_ident(t.tabela))
      AND p.polpermissive
      AND p.polcmd IN ('r', '*')
      AND p.polqual IS NOT NULL
      AND pg_get_expr(p.polqual, p.polrelid) <> 'false'
      AND (p.polroles = '{0}'::oid[] OR 'authenticated' = ANY (
            SELECT rolname FROM pg_roles WHERE oid = ANY (p.polroles)));

    -- Origem sem regra de leitura nenhuma nega tudo; o espelho nega igual.
    IF expr IS NULL THEN
      expr := 'false';
      RAISE NOTICE 'arquivo.%: origem nao tem policy de leitura — espelho nega tudo', t.tabela;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS arquivo_select ON arquivo.%I', t.tabela);
    EXECUTE format(
      'CREATE POLICY arquivo_select ON arquivo.%I FOR SELECT TO authenticated USING (%s)',
      t.tabela, expr);
    apertadas := apertadas + 1;
  END LOOP;

  RAISE NOTICE 'policies do arquivo alinhadas com a origem: %', apertadas;
END $$;
