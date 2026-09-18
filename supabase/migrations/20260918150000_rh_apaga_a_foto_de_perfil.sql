-- O RH remove a foto de perfil pela ficha: sai do cadastro e o arquivo sai do bucket.
--
-- Faltavam as duas pontas:
--
-- 1. employee-photos so tem policy de INSERT (anon/authenticated) e de SELECT. Sem policy de
--    DELETE, storage.remove() devolve lista VAZIA com error null -- o arquivo fica la e a
--    tela nao tem como saber, que e o pior dos dois mundos.
--
-- 2. profiles.avatar_url e uma copia de employees.photo_path, escrita hoje so dentro de
--    set_employee_photo. Quem apagasse a foto pela ficha deixaria a copia apontando para um
--    arquivo que nao existe mais.
--
-- ROLLBACK:
--   DROP POLICY "hr_delete_employee_photos" ON storage.objects;
--   DROP TRIGGER employees_espelha_avatar ON public.employees;
--   DROP FUNCTION public.employees_espelha_avatar();

-- Mesma autorizacao de editar a ficha, que e de onde o botao sai.
DROP POLICY IF EXISTS "hr_delete_employee_photos" ON storage.objects;
CREATE POLICY "hr_delete_employee_photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'employee-photos' AND public.can_access('colaboradores'::text, 'edit'::text));

-- A copia passa a seguir o original sozinha, em vez de depender de cada tela lembrar de
-- escrever nos dois lugares -- set_employee_photo ja errava isso para quem apagava a foto.
CREATE OR REPLACE FUNCTION public.employees_espelha_avatar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    UPDATE public.profiles SET avatar_url = NEW.photo_path
     WHERE id = NEW.user_id AND avatar_url IS DISTINCT FROM NEW.photo_path;
  END IF;
  RETURN NULL;
END; $fn$;

DROP TRIGGER IF EXISTS employees_espelha_avatar ON public.employees;
CREATE TRIGGER employees_espelha_avatar
  AFTER INSERT OR UPDATE OF photo_path, user_id ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.employees_espelha_avatar();
