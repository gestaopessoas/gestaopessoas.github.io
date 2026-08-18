-- Permite gestao (HR) escrever em lunch_lists para montar a ata diaria de almoco.
ALTER TABLE "public"."lunch_lists"
  ADD CONSTRAINT "lunch_lists_employee_date_unique" UNIQUE ("employee_id", "lunch_date");

CREATE POLICY "lunch_lists_insert" ON "public"."lunch_lists"
  FOR INSERT
  WITH CHECK (
    "public"."can_access"('beneficios'::"text", 'create'::"text")
    OR "public"."can_access"('beneficios'::"text", 'edit'::"text")
  );

CREATE POLICY "lunch_lists_update" ON "public"."lunch_lists"
  FOR UPDATE
  USING ("public"."can_access"('beneficios'::"text", 'edit'::"text"))
  WITH CHECK ("public"."can_access"('beneficios'::"text", 'edit'::"text"));

CREATE POLICY "lunch_lists_delete" ON "public"."lunch_lists"
  FOR DELETE
  USING ("public"."can_access"('beneficios'::"text", 'delete'::"text"));
