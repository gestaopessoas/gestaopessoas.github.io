-- Formulário de avaliação customizável: templates com perguntas em JSONB
-- e respostas por solicitação de avaliação (evaluation_requests).

CREATE TABLE IF NOT EXISTS "public"."evaluation_templates" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "name" character varying(150) NOT NULL,
    "description" text,
    "questions" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "created_by" uuid REFERENCES "public"."employees"("id"),
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

ALTER TABLE "public"."evaluation_templates" OWNER TO "postgres";

ALTER TABLE "public"."evaluation_cycles"
    ADD COLUMN IF NOT EXISTS "template_id" uuid REFERENCES "public"."evaluation_templates"("id");

CREATE TABLE IF NOT EXISTS "public"."evaluation_responses" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "request_id" uuid NOT NULL UNIQUE REFERENCES "public"."evaluation_requests"("id") ON DELETE CASCADE,
    "answers" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "status" character varying(20) NOT NULL DEFAULT 'PENDING',
    "submitted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "evaluation_responses_status_check" CHECK (("status")::text = ANY (ARRAY['PENDING'::character varying, 'SUBMITTED'::character varying]::text[]))
);

ALTER TABLE "public"."evaluation_responses" OWNER TO "postgres";

ALTER TABLE "public"."evaluation_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."evaluation_responses" ENABLE ROW LEVEL SECURITY;

-- Templates: qualquer autenticado lê (perguntas não são dado sensível),
-- só quem tem edição em 'avaliacoes' cria/edita/apaga.
CREATE POLICY "evaluation_templates_select" ON "public"."evaluation_templates"
    FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "evaluation_templates_admin_all" ON "public"."evaluation_templates"
    TO "authenticated"
    USING ("public"."can_access"('avaliacoes'::text, 'edit'::text))
    WITH CHECK ("public"."can_access"('avaliacoes'::text, 'edit'::text));

CREATE POLICY "evaluation_templates_no_anon" ON "public"."evaluation_templates"
    TO "anon" USING (false) WITH CHECK (false);

-- Responses: admin de avaliações vê/edita tudo; o avaliador designado
-- lê e grava só a sua própria resposta (via evaluation_requests.evaluator_id).
CREATE POLICY "evaluation_responses_admin_all" ON "public"."evaluation_responses"
    TO "authenticated"
    USING ("public"."can_access"('avaliacoes'::text, 'edit'::text))
    WITH CHECK ("public"."can_access"('avaliacoes'::text, 'edit'::text));

CREATE POLICY "evaluation_responses_evaluator_select" ON "public"."evaluation_responses"
    FOR SELECT TO "authenticated"
    USING (
        EXISTS (
            SELECT 1 FROM "public"."evaluation_requests" r
            JOIN "public"."employees" e ON e."id" = r."evaluator_id"
            WHERE r."id" = "evaluation_responses"."request_id"
              AND e."user_id" = auth.uid()
        )
    );

CREATE POLICY "evaluation_responses_evaluator_insert" ON "public"."evaluation_responses"
    FOR INSERT TO "authenticated"
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM "public"."evaluation_requests" r
            JOIN "public"."employees" e ON e."id" = r."evaluator_id"
            WHERE r."id" = "evaluation_responses"."request_id"
              AND e."user_id" = auth.uid()
        )
    );

CREATE POLICY "evaluation_responses_evaluator_update" ON "public"."evaluation_responses"
    FOR UPDATE TO "authenticated"
    USING (
        EXISTS (
            SELECT 1 FROM "public"."evaluation_requests" r
            JOIN "public"."employees" e ON e."id" = r."evaluator_id"
            WHERE r."id" = "evaluation_responses"."request_id"
              AND e."user_id" = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM "public"."evaluation_requests" r
            JOIN "public"."employees" e ON e."id" = r."evaluator_id"
            WHERE r."id" = "evaluation_responses"."request_id"
              AND e."user_id" = auth.uid()
        )
    );

CREATE POLICY "evaluation_responses_no_anon" ON "public"."evaluation_responses"
    TO "anon" USING (false) WITH CHECK (false);

-- Avaliador precisa enxergar suas próprias solicitações pendentes.
CREATE POLICY "evaluation_requests_evaluator_select" ON "public"."evaluation_requests"
    FOR SELECT TO "authenticated"
    USING (
        auth.uid() = (SELECT e."user_id" FROM "public"."employees" e WHERE e."id" = "evaluation_requests"."evaluator_id")
    );

GRANT ALL ON TABLE "public"."evaluation_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."evaluation_templates" TO "service_role";
GRANT ALL ON TABLE "public"."evaluation_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."evaluation_responses" TO "service_role";
