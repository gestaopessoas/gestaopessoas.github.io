-- Seed de desenvolvimento local. Roda a cada `supabase db reset`.
--
-- NÃO vai para produção: `supabase db push` ignora seeds por padrão.
-- Se um dia rodar `db push --include-seed`, este arquivo criaria um admin com
-- senha conhecida em produção. Não faça isso.
--
-- Cria um usuário para conseguir entrar no /dashboard, que exige login e um
-- profile — o banco local sobe sem nenhum dos dois.
--
--   e-mail: admin@local.dev
--   senha:  admin123
--
-- O level 99 passa pelo `can_access()`, que libera tudo a partir de 50.

DO $$
DECLARE
  v_user_id uuid := '00000000-0000-4000-a000-000000000001';
BEGIN
  -- confirmation_token, recovery_token, email_change_token_new e email_change
  -- não têm default e aceitam NULL, mas o GoTrue lê essas colunas como string
  -- não-nulável: deixá-las nulas faz o login falhar com
  -- "Database error querying schema". Precisam ser string vazia.
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    'admin@local.dev', extensions.crypt('admin123', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id::text, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', 'admin@local.dev', 'email_verified', true),
    'email', now(), now(), now()
  ) ON CONFLICT (provider, provider_id) DO NOTHING;

  INSERT INTO public.profiles (id, name, full_name, level, role)
  VALUES (v_user_id, 'Admin Local', 'Admin Local', 99, 'admin')
  ON CONFLICT (id) DO UPDATE SET level = 99;
END $$;
