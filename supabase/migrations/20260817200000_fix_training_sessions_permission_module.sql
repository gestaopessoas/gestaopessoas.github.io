-- training_sessions checava o módulo de permissão errado ('colaboradores'),
-- enquanto training_satisfaction_metrics/feedback e o restante do app usam
-- 'treinamentos'. Quem tinha acesso só a Treinamentos via RLS enxergava a
-- Central Analítica de Treinamentos vazia (join com a tabela-mãe bloqueado).

DROP POLICY IF EXISTS "training_sessions_select_perm" ON "public"."training_sessions";
DROP POLICY IF EXISTS "training_sessions_write_perm" ON "public"."training_sessions";

CREATE POLICY "training_sessions_select_perm" ON "public"."training_sessions"
    FOR SELECT USING ("public"."can_access"('treinamentos'::text, 'view'::text));

CREATE POLICY "training_sessions_write_perm" ON "public"."training_sessions"
    USING ("public"."can_access"('treinamentos'::text, 'edit'::text))
    WITH CHECK ("public"."can_access"('treinamentos'::text, 'edit'::text));
