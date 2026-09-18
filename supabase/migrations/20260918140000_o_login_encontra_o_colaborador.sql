-- O perfil do usuario mostra iniciais mesmo com foto no cadastro do colaborador.
--
-- Causa: o modal de perfil le `employees` por `user_id = auth.uid()`, e `employees.user_id`
-- esta NULL em TODAS as 200 linhas de producao -- nada no src/ jamais escreve essa coluna.
-- Sem vinculo, nao ha photo_path para o avatar nem para o banner do modal, e
-- set_employee_photo tambem nunca espelha a foto em profiles.avatar_url (ela so escreve
-- quando user_id existe). O mesmo vinculo alimenta nome/cargo/telefone com cadeado e a
-- tela de holerites.
--
-- A chave natural e o e-mail corporativo: 8 dos 9 logins de producao batem com
-- employees.email_corporate. Vinculo so acontece quando a correspondencia e unica dos dois
-- lados -- e-mail repetido fica NULL, como esta hoje.
--
-- ROLLBACK:
--   DROP TRIGGER employees_vincula_login ON public.employees;
--   DROP FUNCTION public.employees_vincula_login();
--   DROP INDEX public.employees_user_id_unico;
--   DROP POLICY "own_read_employee_photo" ON storage.objects;
--   UPDATE public.employees SET user_id = NULL;
--   (handle_new_user volta a versao de 20260814203939)

-- Um login = no maximo um colaborador. O modal usa maybeSingle(): com duas linhas apontando
-- para o mesmo usuario, a consulta falha e a tela inteira cai no erro de carregamento.
CREATE UNIQUE INDEX IF NOT EXISTS employees_user_id_unico
  ON public.employees (user_id) WHERE user_id IS NOT NULL;

-- Vincular login nao e alteracao cadastral: sem esta exclusao, o backfill abaixo e todo
-- cadastro novo viram uma linha "Alteracao em user_id" na linha do tempo do colaborador.
DO $mig$
DECLARE
  f text;
  d text;
  antes  text := $q$NOT IN ('id', 'updated_at', 'created_at', 'photo_path', 'photo_crop'$q$;
  depois text := $q$NOT IN ('id', 'updated_at', 'created_at', 'photo_path', 'photo_crop', 'user_id'$q$;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.log_employee_changes', 'arquivo.log_employee_changes'] LOOP
    d := pg_get_functiondef(f::regproc);
    CONTINUE WHEN position(depois in d) > 0;  -- ja aplicado
    IF position(antes in d) = 0 THEN
      RAISE EXCEPTION 'nao achei a lista de colunas ignoradas em %', f;
    END IF;
    EXECUTE replace(d, antes, depois);
  END LOOP;
END $mig$;

-- Lado "colaborador cadastrado depois do login", que e o caso do RH.
CREATE OR REPLACE FUNCTION public.employees_vincula_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NEW.user_id IS NULL AND NEW.email_corporate IS NOT NULL THEN
    SELECT u.id INTO NEW.user_id
      FROM auth.users u
     WHERE lower(u.email) = lower(btrim(NEW.email_corporate))
       AND NOT EXISTS (SELECT 1 FROM public.employees x WHERE x.user_id = u.id AND x.id <> NEW.id)
     LIMIT 1;
  END IF;
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS employees_vincula_login ON public.employees;
CREATE TRIGGER employees_vincula_login
  BEFORE INSERT OR UPDATE OF email_corporate ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.employees_vincula_login();

-- Lado "login criado depois do cadastro". public.handle_new_user existe desde o baseline mas
-- NAO tem gatilho nenhum ligado em auth.users (verificado: pg_trigger vazio) -- ou seja, o
-- profiles de cada usuario vem sendo criado na mao pelo painel. O gatilho entra aqui junto
-- com o vinculo; o ON CONFLICT ja deixava a funcao idempotente para quem ja tem profile.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_employee uuid;
BEGIN
  INSERT INTO public.profiles (id, name, level)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), COALESCE((new.raw_user_meta_data->>'level')::int, 1))
  ON CONFLICT (id) DO UPDATE SET level = EXCLUDED.level;
  INSERT INTO public.profile_preferences (profile_id) VALUES (new.id) ON CONFLICT (profile_id) DO NOTHING;

  -- LIMIT 1 em vez de UPDATE direto: dois colaboradores com o mesmo e-mail corporativo
  -- baterian no indice unico e abortariam a criacao do usuario.
  SELECT id INTO v_employee FROM public.employees
   WHERE user_id IS NULL AND lower(email_corporate) = lower(new.email) LIMIT 1;
  IF v_employee IS NOT NULL THEN
    UPDATE public.employees SET user_id = new.id WHERE id = v_employee;
    UPDATE public.profiles p SET avatar_url = e.photo_path
      FROM public.employees e WHERE e.id = v_employee AND p.id = new.id AND e.photo_path IS NOT NULL;
  END IF;

  RETURN new;
END; $fn$;

-- Backfill dos vinculos que ja existiam. Bate so quando o e-mail aponta para exatamente um
-- colaborador sem vinculo: repetido fica de fora, para o RH resolver na mao.
UPDATE public.employees e
   SET user_id = u.id
  FROM auth.users u
 WHERE e.user_id IS NULL
   AND e.email_corporate IS NOT NULL
   AND lower(btrim(e.email_corporate)) = lower(u.email)
   AND (SELECT count(*) FROM public.employees x
         WHERE x.user_id IS NULL AND lower(btrim(x.email_corporate)) = lower(u.email)) = 1
   AND NOT EXISTS (SELECT 1 FROM public.employees y WHERE y.user_id = u.id);

-- As fotos enviadas antes do vinculo nunca chegaram ao espelho em profiles.
UPDATE public.profiles p
   SET avatar_url = e.photo_path
  FROM public.employees e
 WHERE e.user_id = p.id AND e.photo_path IS NOT NULL
   AND p.avatar_url IS DISTINCT FROM e.photo_path;

-- O bucket e privado e a unica policy de leitura exige can_access('colaboradores','view'):
-- colaborador comum nao consegue assinar a URL nem da propria foto, e o avatar dele cairia
-- nas iniciais mesmo com o vinculo certo. O caminho e sempre "<employee_id>/...".
-- ponytail: so public.employees. Desligado que continua com login nao le a propria foto.
DROP POLICY IF EXISTS "own_read_employee_photo" ON storage.objects;
CREATE POLICY "own_read_employee_photo"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'employee-photos' AND EXISTS (
    SELECT 1 FROM public.employees e
     WHERE e.user_id = auth.uid()
       AND storage.objects.name LIKE e.id::text || '/%'));

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

NOTIFY pgrst, 'reload schema';
