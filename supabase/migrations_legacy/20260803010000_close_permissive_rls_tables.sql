-- Fecha policies permissivas nas tabelas do app (auditoria RLS 2026-08-03, ground-truth via pg_policies).
-- Remove: SELECT OR true, CRUD USING(true), auth.role()='authenticated' sem gate, e INSERT public sem necessidade.
-- Mantém: fluxos PÚBLICOS legítimos (candidatura anon em candidates/job_applications, teste de personalidade anon em candidate_big_five_results) e RPCs SECURITY DEFINER.
-- Reafirma GRANT/REVOKE e RLS ENABLE.

-- ============================================================
-- employees: fechar SELECT aberto (OR true) + corrigir own-row (auth.uid()=id -> user_id)
-- ============================================================
DROP POLICY IF EXISTS "employees_select" ON public.employees;
DROP POLICY IF EXISTS "Colaborador lê o próprio perfil" ON public.employees;
DROP POLICY IF EXISTS "RH e Gestores leem todos os perfis" ON public.employees;

CREATE POLICY "employees_select_perm"
  ON public.employees FOR SELECT TO authenticated
  USING (
    public.can_access('colaboradores'::text, 'view'::text)
    OR public.can_access('arquivo_morto'::text, 'view'::text)
    OR public.can_access('mp'::text, 'view'::text)
    OR public.can_access('rgs'::text, 'view'::text)
    OR auth.uid() = user_id
  );

-- employees DELETE: já gateado (employees_delete). employees INSERT/UPDATE: já gateados. Manter.

-- ============================================================
-- profiles: expõe 'permissions' a qualquer um (OR true). Fechar.
-- ============================================================
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select_perm"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.can_access('configuracoes'::text, 'view'::text));

-- profiles UPDATE self: já existe (profiles_update_self). profiles_admin_all: gateado. Manter.

-- ============================================================
-- candidates: 'Allow ALL candidates' {public} ALL true -> vazamento CRUD.
-- Mantém INSERT public (candidatura anon em carreiras). Fecha SELECT/UPDATE/DELETE permissivos.
-- ============================================================
DROP POLICY IF EXISTS "Allow ALL candidates" ON public.candidates;
DROP POLICY IF EXISTS "Allow candidates to manage their profile" ON public.candidates;
DROP POLICY IF EXISTS "candidates_select_perm" ON public.candidates;
DROP POLICY IF EXISTS "candidates_update_perm" ON public.candidates;
DROP POLICY IF EXISTS "candidates_delete_perm" ON public.candidates;

-- INSERT public legítimo (carreiras/page.tsx:115, anon)
-- (mantém "Allow public insert to candidates")

-- SELECT: HR (central_candidato/talentos/vagas/recrutamento/analytics) OU dono (user_id)
CREATE POLICY "candidates_select_perm"
  ON public.candidates FOR SELECT TO authenticated
  USING (
    public.can_access('central_candidato'::text, 'view'::text)
    OR public.can_access('talentos'::text, 'view'::text)
    OR public.can_access('vagas'::text, 'view'::text)
    OR public.can_access('recrutamento'::text, 'view'::text)
    OR public.can_access('analytics'::text, 'view'::text)
    OR auth.uid() = user_id
  );

-- UPDATE: HR (central_candidato/talentos/vagas) OU dono
DROP POLICY IF EXISTS "candidates_update_hr_or_owner" ON public.candidates;
CREATE POLICY "candidates_update_hr_or_owner"
  ON public.candidates FOR UPDATE TO authenticated
  USING (
    public.can_access('central_candidato'::text, 'edit'::text)
    OR public.can_access('talentos'::text, 'edit'::text)
    OR public.can_access('vagas'::text, 'edit'::text)
    OR auth.uid() = user_id
  )
  WITH CHECK (
    public.can_access('central_candidato'::text, 'edit'::text)
    OR public.can_access('talentos'::text, 'edit'::text)
    OR public.can_access('vagas'::text, 'edit'::text)
    OR auth.uid() = user_id
  );

-- DELETE: HR central_candidato delete (ou talentos delete)
CREATE POLICY "candidates_delete_perm"
  ON public.candidates FOR DELETE TO authenticated
  USING (
    public.can_access('central_candidato'::text, 'delete'::text)
    OR public.can_access('talentos'::text, 'delete'::text)
  );

-- ============================================================
-- candidate_big_five_results: HR read {authenticated} true + UPDATE {public} true true.
-- Mantém INSERT/UPDATE public (teste de personalidade anon legítimo). Fecha HR read permissivo.
-- ============================================================
DROP POLICY IF EXISTS "HR can read all candidate results" ON public.candidate_big_five_results;

CREATE POLICY "candidate_big_five_results_hr_select"
  ON public.candidate_big_five_results FOR SELECT TO authenticated
  USING (
    public.can_access('talentos'::text, 'view'::text)
    OR public.can_access('recrutamento'::text, 'view'::text)
  );

-- ============================================================
-- lunch_lists: ALL {public} true true -> vazamento (nenhum write no app; só leitura em beneficios).
-- ============================================================
DROP POLICY IF EXISTS "Allow all operations for lunch_lists" ON public.lunch_lists;

-- Refs: beneficios lê. HR ou o próprio colaborador.
CREATE POLICY "lunch_lists_read_hr_or_own"
  ON public.lunch_lists FOR SELECT TO authenticated
  USING (
    public.can_access('beneficios'::text, 'view'::text)
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = auth.uid() AND e.id = lunch_lists.employee_id
    )
  );

-- ============================================================
-- departments: 'Allow public read departments' {public} true + auth.role()='authenticated'.
-- ============================================================
DROP POLICY IF EXISTS "Allow public read departments" ON public.departments;
DROP POLICY IF EXISTS "departments_select" ON public.departments;

CREATE POLICY "departments_select_perm"
  ON public.departments FOR SELECT TO authenticated
  USING (public.can_access('departamentos'::text, 'view'::text));

-- ============================================================
-- public_form_settings: SELECT {public} true + 'Allow admin to manage' {authenticated} ALL true.
-- ============================================================
DROP POLICY IF EXISTS "public_form_settings_select" ON public.public_form_settings;
DROP POLICY IF EXISTS "Allow admin to manage public form settings" ON public.public_form_settings;
DROP POLICY IF EXISTS "public_form_settings_all" ON public.public_form_settings;

CREATE POLICY "public_form_settings_select_perm"
  ON public.public_form_settings FOR SELECT TO authenticated
  USING (public.can_access('configuracoes'::text, 'view'::text));

CREATE POLICY "public_form_settings_write_perm"
  ON public.public_form_settings FOR ALL TO authenticated
  USING (public.can_access('configuracoes'::text, 'edit'::text))
  WITH CHECK (public.can_access('configuracoes'::text, 'edit'::text));

-- ============================================================
-- system_settings: 'system_settings_select_perm' {authenticated} true (qualquer logado lê tudo).
-- Decisão: mps/vagas-nova/colaboradores leem work_schedules/modules SEM gate de módulo (páginas sem usePermissions).
-- SELECT fica TO authenticated (remove anon). Escritas (INSERT/UPDATE/DELETE) gateadas por configuracoes (admin).
-- work_schedules também exposto na RPC get_public_job_form_options (SECURITY DEFINER) para o form público anon.
-- ============================================================
DROP POLICY IF EXISTS "system_settings_select_perm" ON public.system_settings;
DROP POLICY IF EXISTS "Allow authenticated users to read system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow authenticated users to manage system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_select" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_insert" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_update" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_delete" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_write_perm" ON public.system_settings;
DROP POLICY IF EXISTS "Apenas admin visualiza configs" ON public.system_settings;
DROP POLICY IF EXISTS "Apenas admin altera configs" ON public.system_settings;

CREATE POLICY "system_settings_select_perm"
  ON public.system_settings FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated'::text);

CREATE POLICY "system_settings_insert_perm"
  ON public.system_settings FOR INSERT TO authenticated
  WITH CHECK (public.can_access('configuracoes'::text, 'create'::text) OR public.can_access('configuracoes'::text, 'edit'::text));

CREATE POLICY "system_settings_update_perm"
  ON public.system_settings FOR UPDATE TO authenticated
  USING (public.can_access('configuracoes'::text, 'edit'::text))
  WITH CHECK (public.can_access('configuracoes'::text, 'edit'::text));

CREATE POLICY "system_settings_delete_perm"
  ON public.system_settings FOR DELETE TO authenticated
  USING (public.can_access('configuracoes'::text, 'delete'::text));

-- ============================================================
-- system_audit_logs: INSERT {public} true + {authenticated} true -> spoilage de log.
-- Writer é financeiro (authenticated). INSERT fica authenticated-only; SELECT já gateado.
-- ============================================================
DROP POLICY IF EXISTS "system_audit_logs_insert" ON public.system_audit_logs;
DROP POLICY IF EXISTS "system_audit_logs_insert_auth" ON public.system_audit_logs;

CREATE POLICY "system_audit_logs_insert_authenticated"
  ON public.system_audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- companies / workplaces / cost_centers: '*_select_auth' {authenticated} SELECT true.
-- Dado de obra/empresa/centro de custo. Gate por módulo.
-- ============================================================
DROP POLICY IF EXISTS "companies_select_auth" ON public.companies;
DROP POLICY IF EXISTS "workplaces_select_auth" ON public.workplaces;
DROP POLICY IF EXISTS "cost_centers_select_auth" ON public.cost_centers;

CREATE POLICY "companies_select_perm"
  ON public.companies FOR SELECT TO authenticated
  USING (public.can_access('empresas'::text, 'view'::text));

CREATE POLICY "workplaces_select_perm"
  ON public.workplaces FOR SELECT TO authenticated
  USING (public.can_access('obras'::text, 'view'::text));

CREATE POLICY "cost_centers_select_perm"
  ON public.cost_centers FOR SELECT TO authenticated
  USING (public.can_access('centros_de_custo'::text, 'view'::text));

-- ============================================================
-- RPC get_public_job_form_options: estava QUEBRADA no DB vivo (validava colunas
-- is_active/access_code inexistentes em public_form_settings). O form público dependia
-- do fallback anon direto. Corrige: valida access_code via key='job_request_code'
-- (padrão da submit_job_request) e retorna TODOS os dados que o form precisa,
-- inclusive work_schedules e salary_table. Assim o fallback anon pode ser removido.
-- ============================================================
DROP FUNCTION IF EXISTS public.get_public_job_form_options(access_code_param text);

CREATE OR REPLACE FUNCTION public.get_public_job_form_options(access_code_param text)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  expected_code text;
BEGIN
  -- Valida access_code do mesmo jeito que submit_job_request (public_form_settings key/value)
  SELECT value INTO expected_code
  FROM public.public_form_settings
  WHERE key = 'job_request_code';

  IF expected_code IS NULL THEN
    RAISE EXCEPTION 'job_request_code_not_configured';
  END IF;

  IF access_code_param IS NULL OR lower(btrim(access_code_param)) <> lower(btrim(expected_code)) THEN
    RAISE EXCEPTION 'Invalid access code';
  END IF;

  SELECT jsonb_build_object(
    'profiles',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'profile_code', profile_code,
        'title', title,
        'min_education', min_education,
        'desired_education', desired_education,
        'min_experience', min_experience,
        'desired_experience', desired_experience,
        'cnh', cnh,
        'knowledge', knowledge,
        'activities', activities,
        'competencies', competencies
      ) ORDER BY title)
      FROM public.job_profiles
    ), '[]'::jsonb),
    'departments',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY name)
      FROM public.departments
    ), '[]'::jsonb),
    'workplaces',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'type', type) ORDER BY name)
      FROM public.workplaces
    ), '[]'::jsonb),
    'employees',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role) ORDER BY name)
      FROM public.employees
      WHERE status = 'Ativo'
        AND (
          role ILIKE '%coordenador%'
          OR role ILIKE '%diretor%'
          OR role ILIKE '%analista%'
        )
    ), '[]'::jsonb),
    'benefits',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', name) ORDER BY name)
      FROM public.company_benefits
    ), '[]'::jsonb),
    'work_schedules',
    COALESCE((
      SELECT value FROM public.system_settings WHERE key = 'work_schedules' LIMIT 1
    ), '[]'::jsonb),
    'salary_table',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'role_name', role_name,
        'level', level,
        'modality', modality,
        'workplace_id', workplace_id,
        'salary', salary
      ) ORDER BY role_name)
      FROM public.salary_table
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.get_public_job_form_options(text) TO anon, authenticated;

-- ============================================================
-- Reafirmação de privilégios (defense-in-depth) + RLS ENABLE
-- ============================================================
REVOKE ALL PRIVILEGES ON public.system_settings FROM anon;
REVOKE ALL PRIVILEGES ON public.lunch_lists FROM anon;
REVOKE ALL PRIVILEGES ON public.departments FROM anon;
REVOKE ALL PRIVILEGES ON public.public_form_settings FROM anon;
REVOKE ALL PRIVILEGES ON public.profiles FROM anon;
REVOKE ALL PRIVILEGES ON public.system_audit_logs FROM anon;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_big_five_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lunch_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_form_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

notify pgrst, 'reload schema';
