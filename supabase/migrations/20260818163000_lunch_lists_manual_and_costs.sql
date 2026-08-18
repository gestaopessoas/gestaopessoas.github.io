-- Ata do Dia (Almoço Sede) precisa registrar:
-- 1) pessoas manuais que não estão em employees (terceiro/visitante), via manual_name;
-- 2) o custo empresa e o custo colaborador de cada refeição.
ALTER TABLE "public"."lunch_lists"
  ADD COLUMN IF NOT EXISTS "manual_name" "text",
  ADD COLUMN IF NOT EXISTS "company_cost" numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "employee_cost" numeric(10,2) DEFAULT 0;

ALTER TABLE "public"."lunch_lists"
  ADD CONSTRAINT "lunch_lists_employee_or_manual_check"
  CHECK ("employee_id" IS NOT NULL OR "manual_name" IS NOT NULL);

-- Unicidade por dia também para os registros manuais (sem employee_id, unique(employee_id,lunch_date) não pega).
CREATE UNIQUE INDEX IF NOT EXISTS "lunch_lists_manual_date_uidx"
  ON "public"."lunch_lists" ("manual_name", "lunch_date")
  WHERE "manual_name" IS NOT NULL;
