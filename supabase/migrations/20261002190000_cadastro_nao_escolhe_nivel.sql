-- SEGURANCA: handle_new_user lia o nivel de raw_user_meta_data, que e o proprio usuario quem
-- envia no signUp. Com o cadastro publico ligado em producao, qualquer um criava conta ja com
-- level 100 (admin e level >= 50). Agora todo login novo nasce no nivel 1 e quem promove e um
-- admin pela tela de usuarios. ON CONFLICT vira DO NOTHING para nao rebaixar profile existente.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE v_employee uuid;
BEGIN
  INSERT INTO public.profiles (id, name, level)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 1)
  ON CONFLICT (id) DO NOTHING;
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
