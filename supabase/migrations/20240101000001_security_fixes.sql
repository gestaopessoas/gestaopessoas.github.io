-- 1. Função para proteger escalada de privilégios
CREATE OR REPLACE FUNCTION public.protect_profile_escalation()
RETURNS trigger AS $$
BEGIN
  -- Se o usuário estiver atualizando seu próprio perfil e não for admin (level < 50)
  IF auth.uid() = NEW.id AND OLD.level < 50 THEN
    -- Sobrescreve as tentativas de alteração devolvendo aos valores originais
    NEW.level = OLD.level;
    NEW.permissions = OLD.permissions;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger atrelada à tabela profiles
DROP TRIGGER IF EXISTS tr_protect_profile_escalation ON public.profiles;
CREATE TRIGGER tr_protect_profile_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.protect_profile_escalation();


-- 2. Remoção das Políticas Abertas (Anon) Esquecidas
DROP POLICY IF EXISTS "Allow all actions for anon" ON public.contacts;
DROP POLICY IF EXISTS "Allow all actions for anon" ON public.jobs;
DROP POLICY IF EXISTS "Allow all actions for anon" ON public.hires;
DROP POLICY IF EXISTS "Allow all actions for anon" ON public.interviews;
DROP POLICY IF EXISTS "Allow all actions for anon" ON public.training_sessions;
DROP POLICY IF EXISTS "Allow all actions for anon" ON public.training_participants;
DROP POLICY IF EXISTS "Allow all operations for anon on rgs" ON public.rgs_processes;

-- Criação das Políticas de Leitura/Escrita protegidas pelo Auth e can_access para contatos, vagas e contratações (base de RH)
CREATE POLICY "contacts_select" ON public.contacts FOR SELECT USING (public.can_access('recrutamento', 'view'));
CREATE POLICY "contacts_insert" ON public.contacts FOR INSERT WITH CHECK (public.can_access('recrutamento', 'create'));
CREATE POLICY "contacts_update" ON public.contacts FOR UPDATE USING (public.can_access('recrutamento', 'edit')) WITH CHECK (public.can_access('recrutamento', 'edit'));

CREATE POLICY "jobs_select" ON public.jobs FOR SELECT USING (public.can_access('recrutamento', 'view'));
CREATE POLICY "jobs_insert" ON public.jobs FOR INSERT WITH CHECK (public.can_access('recrutamento', 'create'));
CREATE POLICY "jobs_update" ON public.jobs FOR UPDATE USING (public.can_access('recrutamento', 'edit')) WITH CHECK (public.can_access('recrutamento', 'edit'));

CREATE POLICY "hires_select" ON public.hires FOR SELECT USING (public.can_access('recrutamento', 'view'));
CREATE POLICY "hires_insert" ON public.hires FOR INSERT WITH CHECK (public.can_access('recrutamento', 'create'));
CREATE POLICY "hires_update" ON public.hires FOR UPDATE USING (public.can_access('recrutamento', 'edit')) WITH CHECK (public.can_access('recrutamento', 'edit'));


-- 3. Revogar as políticas de exclusão permissivas atuais
DROP POLICY IF EXISTS "employees_delete" ON public.employees;
DROP POLICY IF EXISTS "vacations_all" ON public.vacations;
DROP POLICY IF EXISTS "occupational_exams_all" ON public.occupational_exams;
DROP POLICY IF EXISTS "benefits_all" ON public.benefits;
DROP POLICY IF EXISTS "epi_records_all" ON public.epi_records;

-- Restringir DELETE nas tabelas críticas EXCLUSIVAMENTE para Admins (Sede)
CREATE POLICY "employees_delete_admin_only" ON public.employees 
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND level >= 50)
);

CREATE POLICY "vacations_delete_admin_only" ON public.vacations 
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND level >= 50)
);

CREATE POLICY "vacations_update" ON public.vacations FOR UPDATE USING (public.can_access('colaboradores', 'edit')) WITH CHECK (public.can_access('colaboradores', 'edit'));
CREATE POLICY "vacations_insert" ON public.vacations FOR INSERT WITH CHECK (public.can_access('colaboradores', 'edit'));
