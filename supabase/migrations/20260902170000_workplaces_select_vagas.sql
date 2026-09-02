-- Quem cuida de Vagas precisa ler workplaces para escolher a Obra.
--
-- A Fase 0 (20260902160000) tornou a Obra obrigatoria no formulario de vaga, mas
-- workplaces_select_perm so aceitava 'obras:view' ou 'beneficios:view'. Perfil com nivel < 50 que
-- tem 'vagas:view' e nao tem esses dois modulos via o select de Obra vazio pela RLS -- e, como o
-- campo e obrigatorio, nao conseguia mais salvar vaga nenhuma, nem criar nem editar. O join
-- workplace:workplaces(name) da lista tambem voltava nulo, mostrando "Obra nao informada" para
-- vaga que tem Obra.
--
-- Mesmo motivo e mesma forma do que 20260818160500 fez por 'beneficios'.

DROP POLICY IF EXISTS "workplaces_select_perm" ON "public"."workplaces";

CREATE POLICY "workplaces_select_perm" ON "public"."workplaces"
  FOR SELECT TO "authenticated"
  USING (
    "public"."can_access"('obras'::"text", 'view'::"text")
    OR "public"."can_access"('beneficios'::"text", 'view'::"text")
    OR "public"."can_access"('vagas'::"text", 'view'::"text")
  );
