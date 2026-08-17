-- Distribuição genérica de respostas por pergunta do Excel (ex: "Cumpriu os
-- objetivos propostos?" -> {"Concordo Totalmente": 7, "Concordo Parcialmente": 2}).
-- Substitui o campo "expectations" que nunca chegou a ser persistido nem exibido.

ALTER TABLE "public"."training_satisfaction_metrics"
    ADD COLUMN IF NOT EXISTS "answer_distributions" jsonb NOT NULL DEFAULT '{}'::jsonb;
