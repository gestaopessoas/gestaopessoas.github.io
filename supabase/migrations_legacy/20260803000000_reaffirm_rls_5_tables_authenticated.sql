-- Reafirmação RLS das 5 tabelas do achado S1 (auditoria QA 2026-07-31).
--
-- Contexto: 20260802165000 fechou o nível `anon` (REVOKE + USING(false)); o nível
-- `authenticated` já era gateado por `can_access(...)` vindo de migrations anteriores
-- (init.sql, 20260713223620, 20250328100000, 20240101000001), mas sob nomes duplicados
-- e redundantes (select/insert/update/delete + all/read/write sobrepostos). Esta migration
-- consolida num único conjunto canônico `TO authenticated` e limpa os nomes legados.
--
-- Segurança: nenhuma policy permissiva é criada; DELETE de férias/benefícios/exames/epis
-- passa a exigir a action 'delete' (can_access) em vez de gates mistos.

-- ---------- time_logs (módulo 'ponto') ----------
DROP POLICY IF EXISTS "Allow all operations for time_logs" ON public.time_logs;
DROP POLICY IF EXISTS "Allow all" ON public.time_logs;
DROP POLICY IF EXISTS "time_logs_all" ON public.time_logs;
DROP POLICY IF EXISTS "time_logs_select" ON public.time_logs;
DROP POLICY IF EXISTS "time_logs_insert" ON public.time_logs;
DROP POLICY IF EXISTS "time_logs_update" ON public.time_logs;
DROP POLICY IF EXISTS "time_logs_delete" ON public.time_logs;

CREATE POLICY "time_logs_select" ON public.time_logs
  FOR SELECT TO authenticated USING (public.can_access('ponto'::text, 'view'::text));
CREATE POLICY "time_logs_insert" ON public.time_logs
  FOR INSERT TO authenticated WITH CHECK (public.can_access('ponto'::text, 'create'::text) OR public.can_access('ponto'::text, 'edit'::text));
CREATE POLICY "time_logs_update" ON public.time_logs
  FOR UPDATE TO authenticated USING (public.can_access('ponto'::text, 'edit'::text)) WITH CHECK (public.can_access('ponto'::text, 'edit'::text));
CREATE POLICY "time_logs_delete" ON public.time_logs
  FOR DELETE TO authenticated USING (public.can_access('ponto'::text, 'delete'::text));

-- ---------- vacations ----------
DROP POLICY IF EXISTS "Allow all operations for vacations" ON public.vacations;
DROP POLICY IF EXISTS "Allow all" ON public.vacations;
DROP POLICY IF EXISTS "vacations_all" ON public.vacations;
DROP POLICY IF EXISTS "vacations_select" ON public.vacations;
DROP POLICY IF EXISTS "vacations_insert" ON public.vacations;
DROP POLICY IF EXISTS "vacations_update" ON public.vacations;
DROP POLICY IF EXISTS "vacations_delete_admin_only" ON public.vacations;
DROP POLICY IF EXISTS "vacations_read" ON public.vacations;
DROP POLICY IF EXISTS "vacations_write" ON public.vacations;

CREATE POLICY "vacations_select" ON public.vacations
  FOR SELECT TO authenticated USING (public.can_access('colaboradores'::text, 'view'::text));
CREATE POLICY "vacations_insert" ON public.vacations
  FOR INSERT TO authenticated WITH CHECK (public.can_access('colaboradores'::text, 'create'::text));
CREATE POLICY "vacations_update" ON public.vacations
  FOR UPDATE TO authenticated USING (public.can_access('colaboradores'::text, 'edit'::text)) WITH CHECK (public.can_access('colaboradores'::text, 'edit'::text));
CREATE POLICY "vacations_delete" ON public.vacations
  FOR DELETE TO authenticated USING (public.can_access('colaboradores'::text, 'delete'::text));

-- ---------- employee_benefits ----------
DROP POLICY IF EXISTS "Allow all operations for employee_benefits" ON public.employee_benefits;
DROP POLICY IF EXISTS "Allow all" ON public.employee_benefits;
DROP POLICY IF EXISTS "employee_benefits_all" ON public.employee_benefits;
DROP POLICY IF EXISTS "employee_benefits_select" ON public.employee_benefits;
DROP POLICY IF EXISTS "employee_benefits_insert" ON public.employee_benefits;
DROP POLICY IF EXISTS "employee_benefits_update" ON public.employee_benefits;
DROP POLICY IF EXISTS "employee_benefits_delete" ON public.employee_benefits;
DROP POLICY IF EXISTS "employee_benefits_read" ON public.employee_benefits;
DROP POLICY IF EXISTS "employee_benefits_write" ON public.employee_benefits;

CREATE POLICY "employee_benefits_select" ON public.employee_benefits
  FOR SELECT TO authenticated USING (public.can_access('colaboradores'::text, 'view'::text));
CREATE POLICY "employee_benefits_insert" ON public.employee_benefits
  FOR INSERT TO authenticated WITH CHECK (public.can_access('colaboradores'::text, 'create'::text));
CREATE POLICY "employee_benefits_update" ON public.employee_benefits
  FOR UPDATE TO authenticated USING (public.can_access('colaboradores'::text, 'edit'::text)) WITH CHECK (public.can_access('colaboradores'::text, 'edit'::text));
CREATE POLICY "employee_benefits_delete" ON public.employee_benefits
  FOR DELETE TO authenticated USING (public.can_access('colaboradores'::text, 'delete'::text));

-- ---------- occupational_exams ----------
DROP POLICY IF EXISTS "Allow all operations for occupational_exams" ON public.occupational_exams;
DROP POLICY IF EXISTS "Allow all" ON public.occupational_exams;
DROP POLICY IF EXISTS "occupational_exams_all" ON public.occupational_exams;
DROP POLICY IF EXISTS "occupational_exams_select" ON public.occupational_exams;
DROP POLICY IF EXISTS "occupational_exams_read" ON public.occupational_exams;
DROP POLICY IF EXISTS "occupational_exams_write" ON public.occupational_exams;

CREATE POLICY "occupational_exams_select" ON public.occupational_exams
  FOR SELECT TO authenticated USING (public.can_access('colaboradores'::text, 'view'::text));
CREATE POLICY "occupational_exams_insert" ON public.occupational_exams
  FOR INSERT TO authenticated WITH CHECK (public.can_access('colaboradores'::text, 'create'::text));
CREATE POLICY "occupational_exams_update" ON public.occupational_exams
  FOR UPDATE TO authenticated USING (public.can_access('colaboradores'::text, 'edit'::text)) WITH CHECK (public.can_access('colaboradores'::text, 'edit'::text));
CREATE POLICY "occupational_exams_delete" ON public.occupational_exams
  FOR DELETE TO authenticated USING (public.can_access('colaboradores'::text, 'delete'::text));

-- ---------- employee_epis ----------
DROP POLICY IF EXISTS "Allow all operations for employee_epis" ON public.employee_epis;
DROP POLICY IF EXISTS "Allow all" ON public.employee_epis;
DROP POLICY IF EXISTS "employee_epis_all" ON public.employee_epis;
DROP POLICY IF EXISTS "employee_epis_select" ON public.employee_epis;
DROP POLICY IF EXISTS "employee_epis_read" ON public.employee_epis;
DROP POLICY IF EXISTS "employee_epis_write" ON public.employee_epis;

CREATE POLICY "employee_epis_select" ON public.employee_epis
  FOR SELECT TO authenticated USING (public.can_access('colaboradores'::text, 'view'::text));
CREATE POLICY "employee_epis_insert" ON public.employee_epis
  FOR INSERT TO authenticated WITH CHECK (public.can_access('colaboradores'::text, 'create'::text));
CREATE POLICY "employee_epis_update" ON public.employee_epis
  FOR UPDATE TO authenticated USING (public.can_access('colaboradores'::text, 'edit'::text)) WITH CHECK (public.can_access('colaboradores'::text, 'edit'::text));
CREATE POLICY "employee_epis_delete" ON public.employee_epis
  FOR DELETE TO authenticated USING (public.can_access('colaboradores'::text, 'delete'::text));

-- ---------- fail-closed: garantir RLS habilitado e privilégios ----------
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occupational_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_epis ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON public.time_logs FROM anon;
REVOKE ALL PRIVILEGES ON public.vacations FROM anon;
REVOKE ALL PRIVILEGES ON public.employee_benefits FROM anon;
REVOKE ALL PRIVILEGES ON public.occupational_exams FROM anon;
REVOKE ALL PRIVILEGES ON public.employee_epis FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vacations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_benefits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.occupational_exams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_epis TO authenticated;

-- Recarrega o schema no PostgREST (padrão das migrations do repo).
notify pgrst, 'reload schema';
