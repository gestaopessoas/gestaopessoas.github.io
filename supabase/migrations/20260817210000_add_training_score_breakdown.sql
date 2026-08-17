-- content_score/management_support_score/engagement_score já eram calculados
-- no parser do Excel mas descartados ao salvar (só average_score e
-- weighted_utilization_score persistiam). Necessário pra análise detalhada
-- por componente (conteúdo/gestão/prático) na Central Analítica.

ALTER TABLE "public"."training_satisfaction_metrics"
    ADD COLUMN IF NOT EXISTS "content_score" numeric(5,2),
    ADD COLUMN IF NOT EXISTS "management_support_score" numeric(5,2),
    ADD COLUMN IF NOT EXISTS "engagement_score" numeric(5,2);
