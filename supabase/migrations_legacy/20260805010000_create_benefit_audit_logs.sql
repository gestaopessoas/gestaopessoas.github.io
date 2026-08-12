-- Gestão de Benefícios - Histórico e Auditoria com Suporte a Ações de Desfazer
-- Tabela benefit_audit_logs guarda eventos de corte de benefícios, ignoração de elegibilidade e desfazimento.

CREATE TABLE IF NOT EXISTS public.benefit_audit_logs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id      UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    action_type      TEXT NOT NULL, -- ex: 'REMOVE_BENEFIT', 'IGNORE_INCLUSION', 'IGNORE_ALL_INCLUSION', 'RESTORE_BENEFIT', 'RESTORE_IGNORE'
    benefit_details  TEXT,
    previous_payload JSONB DEFAULT '{}'::jsonb, -- Armazena snapshot anterior para permitir reversão exata por Administradores
    performed_by     UUID DEFAULT auth.uid(),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de performance para busca por colaborador, tipo de ação e ordenação cronológica
CREATE INDEX IF NOT EXISTS idx_benefit_audit_logs_employee ON public.benefit_audit_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_benefit_audit_logs_action ON public.benefit_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_benefit_audit_logs_created_at ON public.benefit_audit_logs(created_at DESC);

-- RLS e Permissões de Segurança
ALTER TABLE public.benefit_audit_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.benefit_audit_logs TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.benefit_audit_logs TO authenticated;

-- Políticas de segurança RLS para audit logs
DROP POLICY IF EXISTS "benefit_audit_logs_select_all" ON public.benefit_audit_logs;
CREATE POLICY "benefit_audit_logs_select_all"
  ON public.benefit_audit_logs FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "benefit_audit_logs_insert_auth" ON public.benefit_audit_logs;
CREATE POLICY "benefit_audit_logs_insert_auth"
  ON public.benefit_audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "benefit_audit_logs_admin_all" ON public.benefit_audit_logs;
CREATE POLICY "benefit_audit_logs_admin_all"
  ON public.benefit_audit_logs FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
