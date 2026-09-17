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

-- Obras (issue #131).
--
-- Sem nenhuma linha em `workplaces`, as Etapas que exigem Obra ("Aguardando Obra",
-- "Em Avaliação na Obra", "Em Obra") ficam inalcançáveis pela tela: o AdvanceStageModal
-- pede a Obra e não há nenhuma para escolher. Três das 14 Etapas ficavam sem cobertura
-- local, e quem escreve e2e descobria isso do jeito difícil.
--
-- A SEDE entra porque `isHeadquarters()` em `candidateLogic.mjs` compara o NOME da Obra com
-- "SEDE" e muda o cálculo da próxima Etapa — esse caminho também não tinha como ser
-- exercitado. A outra é uma obra comum, para o caminho normal.
--
-- `company_id` fica NULL de propósito: é nullable, e nenhuma tela de candidato lê a empresa
-- da Obra. Se um dia ler, aí se cria a empresa aqui.
INSERT INTO public.workplaces (id, name, type, status)
VALUES
  ('00000000-0000-4000-b000-000000000001', 'SEDE', 'SEDE', 'Ativo'),
  ('00000000-0000-4000-b000-000000000002', 'Obra Modelo', 'OBRA', 'Ativo')
ON CONFLICT (id) DO NOTHING;

-- Colaboradores.
--
-- Pelo mesmo motivo das Obras acima: sem nenhuma linha em `employees`, o caso 4 de
-- `e2e/_local-perfil-restrito.spec.ts` ("o que ele TEM permissão de ver continua chegando")
-- falha com total 0. Ele é a contraprova do caso anterior — apertar a regra de permissão não
-- pode ter cegado o próprio módulo de quem tem `colaboradores.view` — e uma base vazia faz a
-- contraprova parecer erro de RLS quando é só falta de dado.
--
-- `unit` é texto solto na tabela, não FK: repete o nome das Obras acima de propósito.
--
-- `role` NÃO é texto livre para a tela: o select "Cargo *" da ficha só oferece títulos de
-- `job_profiles`, e um cargo inventado abre a ficha com um obrigatório vazio — que é o que o
-- caso 7b de `_local-navegacao.spec.ts` reprova. Os dois abaixo já existem lá, em MAIÚSCULAS.
INSERT INTO public.employees (id, name, role, status, unit, admission_date)
VALUES
  ('00000000-0000-4000-c000-000000000001', 'Colaborador Modelo', 'OFICIAL', 'Ativo', 'Obra Modelo', '2026-01-15'),
  ('00000000-0000-4000-c000-000000000002', 'Colaboradora Modelo', 'ENCARREGADO DE OBRAS', 'Ativo', 'SEDE', '2026-02-01')
ON CONFLICT (id) DO NOTHING;
