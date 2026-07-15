-- Fecha vazamento de PII e escrita anonima.
--
-- Contexto: policies permissivas antigas (role `public`, USING true) conviviam com as
-- policies baseadas em can_access(). Policy permissiva SOMA, nao restringe -- entao a
-- de can_access nunca teve efeito enquanto estas existissem.
--
-- Impacto medido antes do fix (via anon key publica, que esta no bundle JS do site):
--   employees -> 5394 linhas legiveis SEM login (nome, CPF, RG, telefone, emails).
--   time_logs / system_settings / system_audit_logs / etc -> leitura E escrita anonima.
--
-- Nao removido de proposito:
--   - Policies `authenticated ... USING (true)`: sao o que mantem o app funcionando hoje.
--     So podem cair depois que existir UI para popular profiles.permissions, senao o app trava.
--   - INSERT anon em candidates / job_applications / applications: formulario publico legitimo.
--   - job_openings_public_select (anon, status='Aberta'): usado pela pagina Carreiras.
--   - departments: form publico pode depender; avaliar antes.

-- Fase 1: leitura publica de PII
DROP POLICY IF EXISTS "Allow public read employees" ON public.employees;
DROP POLICY IF EXISTS "Allow public read lockers" ON public.lockers;

-- Fase 2: escrita/leitura anonima irrestrita
DROP POLICY IF EXISTS "Allow all" ON public.time_logs;
DROP POLICY IF EXISTS "Allow all for anon on system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow all for anon on system_audit_logs" ON public.system_audit_logs;
DROP POLICY IF EXISTS "Allow all actions for anon" ON public.contacts;
DROP POLICY IF EXISTS "Allow all actions for anon" ON public.hires;
DROP POLICY IF EXISTS "Allow all actions for anon" ON public.interviews;
DROP POLICY IF EXISTS "Allow all actions for anon" ON public.jobs;
DROP POLICY IF EXISTS "Allow all actions for anon" ON public.job_profiles;
DROP POLICY IF EXISTS "Allow all actions for anon" ON public.job_openings;
DROP POLICY IF EXISTS "Allow all actions for anon" ON public.training_sessions;
DROP POLICY IF EXISTS "Allow all actions for anon" ON public.training_participants;
