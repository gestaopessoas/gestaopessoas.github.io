-- Fixa search_path em funcoes SECURITY DEFINER.
--
-- Advisor: function_search_path_mutable.
-- Risco: SECURITY DEFINER + search_path mutavel permite que um atacante crie um objeto
-- homonimo num schema que aparece antes no search_path e execute codigo com o privilegio
-- do dono da funcao.
--
-- Sem impacto funcional: as funcoes so referenciam objetos de `public`.

ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_modified_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_settings_modtime() SET search_path = public, pg_temp;
ALTER FUNCTION public.can_access(text, text) SET search_path = public, pg_temp;
