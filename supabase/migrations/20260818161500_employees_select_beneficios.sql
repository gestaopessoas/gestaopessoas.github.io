-- Tela de Benefícios lê employees (status, workplace) para montar a lista de Almoço Sede,
-- mas employees_select_perm não incluía o módulo "beneficios" — quem só tem essa permissão
-- via RLS não enxergava nenhum colaborador, zerando a lista mesmo com 203+ ativos.
DROP POLICY IF EXISTS "employees_select_perm" ON "public"."employees";

CREATE POLICY "employees_select_perm" ON "public"."employees"
  FOR SELECT TO "authenticated"
  USING (
    "public"."can_access"('colaboradores'::"text", 'view'::"text")
    OR "public"."can_access"('arquivo_morto'::"text", 'view'::"text")
    OR "public"."can_access"('mp'::"text", 'view'::"text")
    OR "public"."can_access"('rgs'::"text", 'view'::"text")
    OR "public"."can_access"('beneficios'::"text", 'view'::"text")
    OR ("auth"."uid"() = "user_id")
  );
