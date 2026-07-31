-- Audit 2026-07-31, S1 (ampliado pela rota createClient): anon ainda lia employees.* e candidates.
-- Vazamento real confirmado via REST anon (2026-08-02): GET /rest/v1/employees retorna registros.
-- Fail-closed por ADR 0002:
--   1. REVOKE privilégio anon residual.
--   2. DROP de policies anon/antigas remanescentes (nomes de 00001/manual_repair/20260713141000).
--   3. Policy explícita USING(false) TO anon = negação assertiva.

-- ---------- REVOKE anon (fail-closed) ----------
REVOKE ALL PRIVILEGES ON public.employees            FROM anon;
REVOKE ALL PRIVILEGES ON public.candidates           FROM anon;
REVOKE ALL PRIVILEGES ON public.vacations            FROM anon;
REVOKE ALL PRIVILEGES ON public.time_logs            FROM anon;
REVOKE ALL PRIVILEGES ON public.employee_benefits    FROM anon;
REVOKE ALL PRIVILEGES ON public.occupational_exams   FROM anon;
REVOKE ALL PRIVILEGES ON public.employee_epis        FROM anon;

-- ---------- DROP policies antigas/anon remanescentes ----------
DROP POLICY IF EXISTS "Allow authenticated users to read employees"      ON public.employees;
DROP POLICY IF EXISTS "Enable read access for all users"                 ON public.employees;
DROP POLICY IF EXISTS "Enable all access for authenticated users"        ON public.employees;
DROP POLICY IF EXISTS "Permitir leitura/escrita para todos os autenticados" ON public.employees;

DROP POLICY IF EXISTS "Public can insert candidates"                     ON public.candidates;
DROP POLICY IF EXISTS "Allow authenticated users to select candidates"   ON public.candidates;
DROP POLICY IF EXISTS "Authenticated users can select candidates"        ON public.candidates;
DROP POLICY IF EXISTS "Authenticated users can update candidates"        ON public.candidates;

DROP POLICY IF EXISTS "Allow all operations for vacations"               ON public.vacations;
DROP POLICY IF EXISTS "Allow all operations for time_logs"               ON public.time_logs;
DROP POLICY IF EXISTS "Allow all operations for employee_benefits"       ON public.employee_benefits;
DROP POLICY IF EXISTS "Allow all operations for occupational_exams"      ON public.occupational_exams;
DROP POLICY IF EXISTS "Allow all operations for employee_epis"           ON public.employee_epis;

-- ---------- Policies fail-closed para anon (negação assertiva) ----------
CREATE POLICY "employees_no_anon"
  ON public.employees FOR ALL TO anon
  USING (false) WITH CHECK (false);

CREATE POLICY "candidates_no_anon_select"
  ON public.candidates FOR SELECT TO anon
  USING (false);

CREATE POLICY "vacations_no_anon"
  ON public.vacations FOR ALL TO anon
  USING (false) WITH CHECK (false);

CREATE POLICY "time_logs_no_anon"
  ON public.time_logs FOR ALL TO anon
  USING (false) WITH CHECK (false);

CREATE POLICY "employee_benefits_no_anon"
  ON public.employee_benefits FOR ALL TO anon
  USING (false) WITH CHECK (false);

CREATE POLICY "occupational_exams_no_anon"
  ON public.occupational_exams FOR ALL TO anon
  USING (false) WITH CHECK (false);

CREATE POLICY "employee_epis_no_anon"
  ON public.employee_epis FOR ALL TO anon
  USING (false) WITH CHECK (false);
