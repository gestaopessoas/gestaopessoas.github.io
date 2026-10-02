-- SEGURANCA: profiles_update_self deixava o usuario mudar o proprio level, e a policy de
-- profile_permissions deixava o dono gravar as proprias permissoes. Qualquer login virava admin.
-- Agora: level so muda por quem tem level >= 50 e nunca acima do proprio; permissoes so por admin.
-- auth.uid() nulo = service_role/SQL editor/gatilho de signup, que seguem livres.

CREATE OR REPLACE FUNCTION public.profiles_guard_level()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_caller int;
BEGIN
  IF NEW.level IS DISTINCT FROM OLD.level AND auth.uid() IS NOT NULL THEN
    SELECT level INTO v_caller FROM public.profiles WHERE id = auth.uid();
    IF COALESCE(v_caller, 0) < 50 OR NEW.level > v_caller THEN
      RAISE EXCEPTION 'Sem permissão para alterar o nível de acesso' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS profiles_guard_level ON public.profiles;
CREATE TRIGGER profiles_guard_level
  BEFORE UPDATE OF level ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_level();

DROP POLICY IF EXISTS "profile permissions accessible to owner or administrators" ON public.profile_permissions;

CREATE POLICY profile_permissions_select ON public.profile_permissions
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid()
         OR (SELECT level FROM public.profiles WHERE id = auth.uid()) >= 50);

CREATE POLICY profile_permissions_admin_write ON public.profile_permissions
  FOR ALL TO authenticated
  USING ((SELECT level FROM public.profiles WHERE id = auth.uid()) >= 50)
  WITH CHECK ((SELECT level FROM public.profiles WHERE id = auth.uid()) >= 50);
