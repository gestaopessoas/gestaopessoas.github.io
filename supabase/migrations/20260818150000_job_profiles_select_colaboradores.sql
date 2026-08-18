-- job_profiles só liberava SELECT pra quem tinha 'vagas' ou 'talentos'. O Select de
-- Cargo no Perfil do Colaborador/Candidato (CandidateProfileModal) busca os títulos
-- dessa tabela pra popular a lista — sem permissão, o RLS filtra tudo silenciosamente
-- (sem erro) e o campo fica com placeholder "Cargo" sem nenhuma opção pra escolher,
-- parecendo desabilitado.
DROP POLICY IF EXISTS "job_profiles_select_perm" ON "public"."job_profiles";

CREATE POLICY "job_profiles_select_perm" ON "public"."job_profiles" FOR SELECT USING (
  "public"."can_access"('vagas'::"text", 'view'::"text")
  OR "public"."can_access"('talentos'::"text", 'view'::"text")
  OR "public"."can_access"('colaboradores'::"text", 'view'::"text")
  OR "public"."can_access"('central_candidato'::"text", 'view'::"text")
);
