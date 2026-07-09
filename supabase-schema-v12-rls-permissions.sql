-- Permission-backed RLS. Run this whole file after the existing schema files.

CREATE OR REPLACE FUNCTION public.can_access(module_key text, action_key text DEFAULT 'view')
RETURNS boolean AS $$
DECLARE
  profile public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO profile FROM public.profiles WHERE id = auth.uid();

  IF profile.id IS NULL THEN
    RETURN false;
  END IF;

  IF profile.level >= 50 THEN
    RETURN true;
  END IF;

  RETURN COALESCE((profile.permissions -> module_key ->> action_key)::boolean, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.can_access('configuracoes'::text, 'view'::text));
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL USING (public.can_access('configuracoes'::text, 'edit'::text)) WITH CHECK (public.can_access('configuracoes'::text, 'edit'::text));

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.departments;
DROP POLICY IF EXISTS "departments_select" ON public.departments;
DROP POLICY IF EXISTS "departments_admin_all" ON public.departments;
CREATE POLICY "departments_select" ON public.departments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "departments_admin_all" ON public.departments FOR ALL USING (public.can_access('configuracoes'::text, 'edit'::text)) WITH CHECK (public.can_access('configuracoes'::text, 'edit'::text));

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.employees;
DROP POLICY IF EXISTS "employees_select" ON public.employees;
DROP POLICY IF EXISTS "employees_insert" ON public.employees;
DROP POLICY IF EXISTS "employees_update" ON public.employees;
DROP POLICY IF EXISTS "employees_delete" ON public.employees;
CREATE POLICY "employees_select" ON public.employees FOR SELECT USING (public.can_access('colaboradores'::text, 'view'::text) OR public.can_access('arquivo_morto'::text, 'view'::text) OR public.can_access('mp'::text, 'view'::text));
CREATE POLICY "employees_insert" ON public.employees FOR INSERT WITH CHECK (public.can_access('colaboradores'::text, 'create'::text) OR public.can_access('mp'::text, 'create'::text));
CREATE POLICY "employees_update" ON public.employees FOR UPDATE USING (public.can_access('colaboradores'::text, 'edit'::text) OR public.can_access('arquivo_morto'::text, 'edit'::text) OR public.can_access('mp'::text, 'edit'::text)) WITH CHECK (public.can_access('colaboradores'::text, 'edit'::text) OR public.can_access('arquivo_morto'::text, 'edit'::text) OR public.can_access('mp'::text, 'edit'::text));
CREATE POLICY "employees_delete" ON public.employees FOR DELETE USING (public.can_access('colaboradores'::text, 'delete'::text));

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.lockers;
DROP POLICY IF EXISTS "lockers_all" ON public.lockers;
DROP POLICY IF EXISTS "lockers_select" ON public.lockers;
DROP POLICY IF EXISTS "lockers_insert" ON public.lockers;
DROP POLICY IF EXISTS "lockers_update" ON public.lockers;
DROP POLICY IF EXISTS "lockers_delete" ON public.lockers;
CREATE POLICY "lockers_select" ON public.lockers FOR SELECT USING (public.can_access('armarios'::text, 'view'::text));
CREATE POLICY "lockers_insert" ON public.lockers FOR INSERT WITH CHECK (public.can_access('armarios'::text, 'create'::text) OR public.can_access('armarios'::text, 'edit'::text));
CREATE POLICY "lockers_update" ON public.lockers FOR UPDATE USING (public.can_access('armarios'::text, 'edit'::text)) WITH CHECK (public.can_access('armarios'::text, 'edit'::text));
CREATE POLICY "lockers_delete" ON public.lockers FOR DELETE USING (public.can_access('armarios'::text, 'delete'::text));

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.uniforms;
DROP POLICY IF EXISTS "uniforms_all" ON public.uniforms;
DROP POLICY IF EXISTS "uniforms_select" ON public.uniforms;
DROP POLICY IF EXISTS "uniforms_insert" ON public.uniforms;
DROP POLICY IF EXISTS "uniforms_update" ON public.uniforms;
DROP POLICY IF EXISTS "uniforms_delete" ON public.uniforms;
CREATE POLICY "uniforms_select" ON public.uniforms FOR SELECT USING (public.can_access('uniformes'::text, 'view'::text));
CREATE POLICY "uniforms_insert" ON public.uniforms FOR INSERT WITH CHECK (public.can_access('uniformes'::text, 'create'::text) OR public.can_access('uniformes'::text, 'edit'::text));
CREATE POLICY "uniforms_update" ON public.uniforms FOR UPDATE USING (public.can_access('uniformes'::text, 'edit'::text)) WITH CHECK (public.can_access('uniformes'::text, 'edit'::text));
CREATE POLICY "uniforms_delete" ON public.uniforms FOR DELETE USING (public.can_access('uniformes'::text, 'delete'::text));

DO $$
BEGIN
  IF to_regclass('public.uniform_stock') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Allow all operations for uniform_stock" ON public.uniform_stock;
    DROP POLICY IF EXISTS "uniform_stock_all" ON public.uniform_stock;
    DROP POLICY IF EXISTS "uniform_stock_select" ON public.uniform_stock;
    DROP POLICY IF EXISTS "uniform_stock_insert" ON public.uniform_stock;
    DROP POLICY IF EXISTS "uniform_stock_update" ON public.uniform_stock;
    DROP POLICY IF EXISTS "uniform_stock_delete" ON public.uniform_stock;
    CREATE POLICY "uniform_stock_select" ON public.uniform_stock FOR SELECT USING (public.can_access('uniformes'::text, 'view'::text));
    CREATE POLICY "uniform_stock_insert" ON public.uniform_stock FOR INSERT WITH CHECK (public.can_access('uniformes'::text, 'create'::text) OR public.can_access('uniformes'::text, 'edit'::text));
    CREATE POLICY "uniform_stock_update" ON public.uniform_stock FOR UPDATE USING (public.can_access('uniformes'::text, 'edit'::text)) WITH CHECK (public.can_access('uniformes'::text, 'edit'::text));
    CREATE POLICY "uniform_stock_delete" ON public.uniform_stock FOR DELETE USING (public.can_access('uniformes'::text, 'delete'::text));
  END IF;
END $$;

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.islands;
DROP POLICY IF EXISTS "islands_all" ON public.islands;
DROP POLICY IF EXISTS "islands_select" ON public.islands;
DROP POLICY IF EXISTS "islands_insert" ON public.islands;
DROP POLICY IF EXISTS "islands_update" ON public.islands;
DROP POLICY IF EXISTS "islands_delete" ON public.islands;
CREATE POLICY "islands_select" ON public.islands FOR SELECT USING (public.can_access('ilhas'::text, 'view'::text));
CREATE POLICY "islands_insert" ON public.islands FOR INSERT WITH CHECK (public.can_access('ilhas'::text, 'create'::text) OR public.can_access('ilhas'::text, 'edit'::text));
CREATE POLICY "islands_update" ON public.islands FOR UPDATE USING (public.can_access('ilhas'::text, 'edit'::text)) WITH CHECK (public.can_access('ilhas'::text, 'edit'::text));
CREATE POLICY "islands_delete" ON public.islands FOR DELETE USING (public.can_access('ilhas'::text, 'delete'::text));

DROP POLICY IF EXISTS "Allow all operations for time_logs" ON public.time_logs;
DROP POLICY IF EXISTS "time_logs_all" ON public.time_logs;
DROP POLICY IF EXISTS "time_logs_select" ON public.time_logs;
DROP POLICY IF EXISTS "time_logs_insert" ON public.time_logs;
DROP POLICY IF EXISTS "time_logs_update" ON public.time_logs;
DROP POLICY IF EXISTS "time_logs_delete" ON public.time_logs;
CREATE POLICY "time_logs_select" ON public.time_logs FOR SELECT USING (public.can_access('ponto'::text, 'view'::text));
CREATE POLICY "time_logs_insert" ON public.time_logs FOR INSERT WITH CHECK (public.can_access('ponto'::text, 'create'::text) OR public.can_access('ponto'::text, 'edit'::text));
CREATE POLICY "time_logs_update" ON public.time_logs FOR UPDATE USING (public.can_access('ponto'::text, 'edit'::text)) WITH CHECK (public.can_access('ponto'::text, 'edit'::text));
CREATE POLICY "time_logs_delete" ON public.time_logs FOR DELETE USING (public.can_access('ponto'::text, 'delete'::text));

DROP POLICY IF EXISTS "Allow all operations for vacations" ON public.vacations;
DROP POLICY IF EXISTS "Allow all operations for employee_benefits" ON public.employee_benefits;
DROP POLICY IF EXISTS "Allow all operations for occupational_exams" ON public.occupational_exams;
DROP POLICY IF EXISTS "Allow all operations for employee_epis" ON public.employee_epis;
DROP POLICY IF EXISTS "vacations_all" ON public.vacations;
DROP POLICY IF EXISTS "employee_benefits_all" ON public.employee_benefits;
DROP POLICY IF EXISTS "occupational_exams_all" ON public.occupational_exams;
DROP POLICY IF EXISTS "employee_epis_all" ON public.employee_epis;
DROP POLICY IF EXISTS "vacations_select" ON public.vacations;
DROP POLICY IF EXISTS "employee_benefits_select" ON public.employee_benefits;
DROP POLICY IF EXISTS "occupational_exams_select" ON public.occupational_exams;
DROP POLICY IF EXISTS "employee_epis_select" ON public.employee_epis;
CREATE POLICY "vacations_all" ON public.vacations FOR ALL USING (public.can_access('colaboradores'::text, 'edit'::text)) WITH CHECK (public.can_access('colaboradores'::text, 'edit'::text));
CREATE POLICY "employee_benefits_all" ON public.employee_benefits FOR ALL USING (public.can_access('colaboradores'::text, 'edit'::text)) WITH CHECK (public.can_access('colaboradores'::text, 'edit'::text));
CREATE POLICY "occupational_exams_all" ON public.occupational_exams FOR ALL USING (public.can_access('colaboradores'::text, 'edit'::text)) WITH CHECK (public.can_access('colaboradores'::text, 'edit'::text));
CREATE POLICY "employee_epis_all" ON public.employee_epis FOR ALL USING (public.can_access('colaboradores'::text, 'edit'::text)) WITH CHECK (public.can_access('colaboradores'::text, 'edit'::text));
CREATE POLICY "vacations_select" ON public.vacations FOR SELECT USING (public.can_access('colaboradores'::text, 'view'::text));
CREATE POLICY "employee_benefits_select" ON public.employee_benefits FOR SELECT USING (public.can_access('colaboradores'::text, 'view'::text));
CREATE POLICY "occupational_exams_select" ON public.occupational_exams FOR SELECT USING (public.can_access('colaboradores'::text, 'view'::text));
CREATE POLICY "employee_epis_select" ON public.employee_epis FOR SELECT USING (public.can_access('colaboradores'::text, 'view'::text));

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.memos;
DROP POLICY IF EXISTS "memos_all" ON public.memos;
DROP POLICY IF EXISTS "memos_select" ON public.memos;
CREATE POLICY "memos_all" ON public.memos FOR ALL USING (public.can_access('mp'::text, 'edit'::text)) WITH CHECK (public.can_access('mp'::text, 'create'::text) OR public.can_access('mp'::text, 'edit'::text));
CREATE POLICY "memos_select" ON public.memos FOR SELECT USING (public.can_access('mp'::text, 'view'::text));

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.job_profiles;
DROP POLICY IF EXISTS "Allow all actions for anon" ON public.job_openings;
DROP POLICY IF EXISTS "job_profiles_all" ON public.job_profiles;
DROP POLICY IF EXISTS "job_openings_all" ON public.job_openings;
DROP POLICY IF EXISTS "job_profiles_select" ON public.job_profiles;
DROP POLICY IF EXISTS "job_openings_select" ON public.job_openings;
CREATE POLICY "job_profiles_all" ON public.job_profiles FOR ALL USING (public.can_access('vagas'::text, 'edit'::text)) WITH CHECK (public.can_access('vagas'::text, 'edit'::text));
CREATE POLICY "job_openings_all" ON public.job_openings FOR ALL USING (public.can_access('vagas'::text, 'edit'::text)) WITH CHECK (public.can_access('vagas'::text, 'create'::text) OR public.can_access('vagas'::text, 'edit'::text));
CREATE POLICY "job_profiles_select" ON public.job_profiles FOR SELECT USING (public.can_access('vagas'::text, 'view'::text));
CREATE POLICY "job_openings_select" ON public.job_openings FOR SELECT USING (public.can_access('vagas'::text, 'view'::text));

DROP POLICY IF EXISTS "rgs_processes_all" ON public.rgs_processes;
DROP POLICY IF EXISTS "rgs_processes_select" ON public.rgs_processes;
CREATE POLICY "rgs_processes_all" ON public.rgs_processes FOR ALL USING (public.can_access('rgs'::text, 'edit'::text) OR public.can_access('mp'::text, 'edit'::text)) WITH CHECK (public.can_access('rgs'::text, 'edit'::text) OR public.can_access('rgs'::text, 'create'::text) OR public.can_access('mp'::text, 'create'::text));
CREATE POLICY "rgs_processes_select" ON public.rgs_processes FOR SELECT USING (public.can_access('rgs'::text, 'view'::text) OR public.can_access('mp'::text, 'view'::text));
