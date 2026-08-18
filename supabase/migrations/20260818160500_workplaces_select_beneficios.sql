-- Permite que quem tem acesso ao módulo "beneficios" também leia workplaces.
-- Sem isso, o join employees->workplaces(type) na tela de Benefícios (Almoço Sede)
-- retorna null via RLS para quem não tem "obras:view", zerando a lista mesmo com colaboradores ativos.
DROP POLICY IF EXISTS "workplaces_select_perm" ON "public"."workplaces";

CREATE POLICY "workplaces_select_perm" ON "public"."workplaces"
  FOR SELECT TO "authenticated"
  USING (
    "public"."can_access"('obras'::"text", 'view'::"text")
    OR "public"."can_access"('beneficios'::"text", 'view'::"text")
  );
