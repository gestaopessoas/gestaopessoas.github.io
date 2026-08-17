-- Guarda cada linha do Excel de satisfação individualmente (1 registro por
-- respondente), além dos agregados já existentes em training_satisfaction_metrics.
-- Permite reprocessar/cruzar dados no futuro sem depender só da média salva.

CREATE TABLE IF NOT EXISTS "public"."training_satisfaction_responses" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "training_session_id" uuid NOT NULL REFERENCES "public"."training_sessions"("id") ON DELETE CASCADE,
    "score" numeric(5,2),
    "answers" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "public"."training_satisfaction_responses" OWNER TO "postgres";
ALTER TABLE "public"."training_satisfaction_responses" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_satisfaction_responses_access" ON "public"."training_satisfaction_responses"
    FOR ALL TO "authenticated"
    USING ("public"."can_access"('treinamentos'::text, 'view'::text))
    WITH CHECK ("public"."can_access"('treinamentos'::text, 'edit'::text) OR "public"."can_access"('treinamentos'::text, 'create'::text));

GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."training_satisfaction_responses" TO "authenticated";

CREATE INDEX IF NOT EXISTS "training_satisfaction_responses_session_idx"
    ON "public"."training_satisfaction_responses" ("training_session_id");
