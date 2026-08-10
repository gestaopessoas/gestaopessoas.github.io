-- Migration para criação da tabela de prospectos (candidatos) a parceiros ACPO
-- Diferente da partner_leads que é usada para os colaboradores resgatarem benefícios,
-- esta tabela será utilizada na captação pública (sem autenticação prévia) de novos convênios.

CREATE TABLE IF NOT EXISTS public.partner_prospects (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name   TEXT NOT NULL,
    contact_name   TEXT NOT NULL,
    email          TEXT NOT NULL,
    phone          TEXT NOT NULL,
    status         TEXT DEFAULT 'pendente', -- pendente, em_contato, aprovado, rejeitado
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger de atualização de updated_at para partner_prospects
CREATE OR REPLACE FUNCTION public.set_partner_prospects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_partner_prospects_updated_at ON public.partner_prospects;
CREATE TRIGGER trg_partner_prospects_updated_at
BEFORE UPDATE ON public.partner_prospects
FOR EACH ROW
EXECUTE FUNCTION public.set_partner_prospects_updated_at();

-- Habilitar RLS
ALTER TABLE public.partner_prospects ENABLE ROW LEVEL SECURITY;

-- Permissões de tabelas
GRANT SELECT, INSERT ON public.partner_prospects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_prospects TO authenticated;

-- Policies
-- Anon (Portal Público): Só pode INSERIR. Não pode LER registros.
DROP POLICY IF EXISTS "partner_prospects_anon_insert" ON public.partner_prospects;
CREATE POLICY "partner_prospects_anon_insert"
  ON public.partner_prospects
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Authenticated (Admin/RH): Pode INSERIR (se necessário) a partir de leads manuais
DROP POLICY IF EXISTS "partner_prospects_auth_insert" ON public.partner_prospects;
CREATE POLICY "partner_prospects_auth_insert"
  ON public.partner_prospects
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated (Admin/RH): Pode LER tudo para gerenciar a fila
DROP POLICY IF EXISTS "partner_prospects_auth_select" ON public.partner_prospects;
CREATE POLICY "partner_prospects_auth_select"
  ON public.partner_prospects
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated (Admin/RH): Pode ATUALIZAR status de prospectos
DROP POLICY IF EXISTS "partner_prospects_auth_update" ON public.partner_prospects;
CREATE POLICY "partner_prospects_auth_update"
  ON public.partner_prospects
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Authenticated (Admin/RH): Pode DELETAR prospectos (excluir lead)
DROP POLICY IF EXISTS "partner_prospects_auth_delete" ON public.partner_prospects;
CREATE POLICY "partner_prospects_auth_delete"
  ON public.partner_prospects
  FOR DELETE
  TO authenticated
  USING (true);
