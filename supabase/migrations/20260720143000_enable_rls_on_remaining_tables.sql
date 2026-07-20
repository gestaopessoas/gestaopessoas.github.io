-- Enable RLS on uniform_items
ALTER TABLE public.uniform_items ENABLE ROW LEVEL SECURITY;

-- Create policies for uniform_items
DROP POLICY IF EXISTS "uniform_items_select" ON public.uniform_items;
CREATE POLICY "uniform_items_select" ON public.uniform_items
  FOR SELECT TO public
  USING (can_access('uniformes'::text, 'view'::text));

DROP POLICY IF EXISTS "uniform_items_insert" ON public.uniform_items;
CREATE POLICY "uniform_items_insert" ON public.uniform_items
  FOR INSERT TO public
  WITH CHECK (can_access('uniformes'::text, 'create'::text) OR can_access('uniformes'::text, 'edit'::text));

DROP POLICY IF EXISTS "uniform_items_update" ON public.uniform_items;
CREATE POLICY "uniform_items_update" ON public.uniform_items
  FOR UPDATE TO public
  USING (can_access('uniformes'::text, 'edit'::text))
  WITH CHECK (can_access('uniformes'::text, 'edit'::text));

DROP POLICY IF EXISTS "uniform_items_delete" ON public.uniform_items;
CREATE POLICY "uniform_items_delete" ON public.uniform_items
  FOR DELETE TO public
  USING (can_access('uniformes'::text, 'delete'::text));


-- Enable RLS on employee_uniforms
ALTER TABLE public.employee_uniforms ENABLE ROW LEVEL SECURITY;

-- Create policies for employee_uniforms
DROP POLICY IF EXISTS "employee_uniforms_select" ON public.employee_uniforms;
CREATE POLICY "employee_uniforms_select" ON public.employee_uniforms
  FOR SELECT TO public
  USING (can_access('uniformes'::text, 'view'::text));

DROP POLICY IF EXISTS "employee_uniforms_insert" ON public.employee_uniforms;
CREATE POLICY "employee_uniforms_insert" ON public.employee_uniforms
  FOR INSERT TO public
  WITH CHECK (can_access('uniformes'::text, 'create'::text) OR can_access('uniformes'::text, 'edit'::text));

DROP POLICY IF EXISTS "employee_uniforms_update" ON public.employee_uniforms;
CREATE POLICY "employee_uniforms_update" ON public.employee_uniforms
  FOR UPDATE TO public
  USING (can_access('uniformes'::text, 'edit'::text))
  WITH CHECK (can_access('uniformes'::text, 'edit'::text));

DROP POLICY IF EXISTS "employee_uniforms_delete" ON public.employee_uniforms;
CREATE POLICY "employee_uniforms_delete" ON public.employee_uniforms
  FOR DELETE TO public
  USING (can_access('uniformes'::text, 'delete'::text));


-- Enable RLS on rgs_processes
ALTER TABLE public.rgs_processes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rgs_processes_select" ON public.rgs_processes;
CREATE POLICY "rgs_processes_select" ON public.rgs_processes FOR SELECT TO public USING (can_access('rgs'::text, 'view'::text));

DROP POLICY IF EXISTS "rgs_processes_insert" ON public.rgs_processes;
CREATE POLICY "rgs_processes_insert" ON public.rgs_processes FOR INSERT TO public WITH CHECK (can_access('rgs'::text, 'create'::text) OR can_access('rgs'::text, 'edit'::text));

DROP POLICY IF EXISTS "rgs_processes_update" ON public.rgs_processes;
CREATE POLICY "rgs_processes_update" ON public.rgs_processes FOR UPDATE TO public USING (can_access('rgs'::text, 'edit'::text)) WITH CHECK (can_access('rgs'::text, 'edit'::text));

DROP POLICY IF EXISTS "rgs_processes_delete" ON public.rgs_processes;
CREATE POLICY "rgs_processes_delete" ON public.rgs_processes FOR DELETE TO public USING (can_access('rgs'::text, 'delete'::text));


-- Enable RLS on employee_promotions
ALTER TABLE public.employee_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_promotions_select" ON public.employee_promotions;
CREATE POLICY "employee_promotions_select" ON public.employee_promotions FOR SELECT TO public USING (can_access('colaboradores'::text, 'view'::text));

DROP POLICY IF EXISTS "employee_promotions_insert" ON public.employee_promotions;
CREATE POLICY "employee_promotions_insert" ON public.employee_promotions FOR INSERT TO public WITH CHECK (can_access('colaboradores'::text, 'create'::text) OR can_access('colaboradores'::text, 'edit'::text));

DROP POLICY IF EXISTS "employee_promotions_update" ON public.employee_promotions;
CREATE POLICY "employee_promotions_update" ON public.employee_promotions FOR UPDATE TO public USING (can_access('colaboradores'::text, 'edit'::text)) WITH CHECK (can_access('colaboradores'::text, 'edit'::text));

DROP POLICY IF EXISTS "employee_promotions_delete" ON public.employee_promotions;
CREATE POLICY "employee_promotions_delete" ON public.employee_promotions FOR DELETE TO public USING (can_access('colaboradores'::text, 'delete'::text));


-- Enable RLS on company_benefits
ALTER TABLE public.company_benefits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_benefits_select" ON public.company_benefits;
CREATE POLICY "company_benefits_select" ON public.company_benefits FOR SELECT TO public USING (can_access('beneficios'::text, 'view'::text));

DROP POLICY IF EXISTS "company_benefits_insert" ON public.company_benefits;
CREATE POLICY "company_benefits_insert" ON public.company_benefits FOR INSERT TO public WITH CHECK (can_access('beneficios'::text, 'create'::text) OR can_access('beneficios'::text, 'edit'::text));

DROP POLICY IF EXISTS "company_benefits_update" ON public.company_benefits;
CREATE POLICY "company_benefits_update" ON public.company_benefits FOR UPDATE TO public USING (can_access('beneficios'::text, 'edit'::text)) WITH CHECK (can_access('beneficios'::text, 'edit'::text));

DROP POLICY IF EXISTS "company_benefits_delete" ON public.company_benefits;
CREATE POLICY "company_benefits_delete" ON public.company_benefits FOR DELETE TO public USING (can_access('beneficios'::text, 'delete'::text));


-- Enable RLS on system_audit_logs
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_audit_logs_select" ON public.system_audit_logs;
CREATE POLICY "system_audit_logs_select" ON public.system_audit_logs FOR SELECT TO public USING (can_access('configuracoes'::text, 'view'::text));

DROP POLICY IF EXISTS "system_audit_logs_insert" ON public.system_audit_logs;
CREATE POLICY "system_audit_logs_insert" ON public.system_audit_logs FOR INSERT TO public WITH CHECK (true);


-- Enable RLS on benefit_ignores
ALTER TABLE public.benefit_ignores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "benefit_ignores_select" ON public.benefit_ignores;
CREATE POLICY "benefit_ignores_select" ON public.benefit_ignores FOR SELECT TO public USING (can_access('beneficios'::text, 'view'::text));

DROP POLICY IF EXISTS "benefit_ignores_insert" ON public.benefit_ignores;
CREATE POLICY "benefit_ignores_insert" ON public.benefit_ignores FOR INSERT TO public WITH CHECK (can_access('beneficios'::text, 'create'::text) OR can_access('beneficios'::text, 'edit'::text));

DROP POLICY IF EXISTS "benefit_ignores_update" ON public.benefit_ignores;
CREATE POLICY "benefit_ignores_update" ON public.benefit_ignores FOR UPDATE TO public USING (can_access('beneficios'::text, 'edit'::text)) WITH CHECK (can_access('beneficios'::text, 'edit'::text));

DROP POLICY IF EXISTS "benefit_ignores_delete" ON public.benefit_ignores;
CREATE POLICY "benefit_ignores_delete" ON public.benefit_ignores FOR DELETE TO public USING (can_access('beneficios'::text, 'delete'::text));


-- Enable RLS on system_settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_settings_select" ON public.system_settings;
CREATE POLICY "system_settings_select" ON public.system_settings FOR SELECT TO public USING (can_access('configuracoes'::text, 'view'::text));

DROP POLICY IF EXISTS "system_settings_insert" ON public.system_settings;
CREATE POLICY "system_settings_insert" ON public.system_settings FOR INSERT TO public WITH CHECK (can_access('configuracoes'::text, 'create'::text) OR can_access('configuracoes'::text, 'edit'::text));

DROP POLICY IF EXISTS "system_settings_update" ON public.system_settings;
CREATE POLICY "system_settings_update" ON public.system_settings FOR UPDATE TO public USING (can_access('configuracoes'::text, 'edit'::text)) WITH CHECK (can_access('configuracoes'::text, 'edit'::text));

DROP POLICY IF EXISTS "system_settings_delete" ON public.system_settings;
CREATE POLICY "system_settings_delete" ON public.system_settings FOR DELETE TO public USING (can_access('configuracoes'::text, 'delete'::text));


-- Enable RLS on public_form_settings
ALTER TABLE public.public_form_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_form_settings_select" ON public.public_form_settings;
CREATE POLICY "public_form_settings_select" ON public.public_form_settings FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_form_settings_all" ON public.public_form_settings;
CREATE POLICY "public_form_settings_all" ON public.public_form_settings FOR ALL TO public USING (can_access('configuracoes'::text, 'edit'::text));
