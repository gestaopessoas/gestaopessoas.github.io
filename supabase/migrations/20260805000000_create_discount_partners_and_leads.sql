-- Clube de Descontos e Parceiros: estrutura DDL para gestão de convênios e registro de resgates/leads.
-- Tabela discount_partners mantem o catálogo ativo dos convênios.
-- Tabela partner_leads registra quando o colaborador solicita um cupom/resgate.

CREATE TABLE IF NOT EXISTS public.discount_partners (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT NOT NULL,
    category       TEXT NOT NULL,
    discount_rules TEXT NOT NULL,
    promocodes     TEXT[] DEFAULT '{}',
    logo_url       TEXT,
    is_active      BOOLEAN DEFAULT true,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.partner_leads (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id     UUID REFERENCES public.discount_partners(id) ON DELETE CASCADE,
    employee_id    UUID NOT NULL,
    status         TEXT DEFAULT 'resgatado',
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger de atualização de updated_at para discount_partners
CREATE OR REPLACE FUNCTION public.set_discount_partners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_discount_partners_updated_at ON public.discount_partners;
CREATE TRIGGER trg_discount_partners_updated_at
BEFORE UPDATE ON public.discount_partners
FOR EACH ROW
EXECUTE FUNCTION public.set_discount_partners_updated_at();

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_discount_partners_active_category ON public.discount_partners(is_active, category);
CREATE INDEX IF NOT EXISTS idx_partner_leads_partner_employee ON public.partner_leads(partner_id, employee_id);

-- RLS e Permissões
ALTER TABLE public.discount_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_leads ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.discount_partners TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.discount_partners TO authenticated;
GRANT SELECT, INSERT ON public.partner_leads TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.partner_leads TO authenticated;

-- Políticas RLS para discount_partners
DROP POLICY IF EXISTS "discount_partners_select_active" ON public.discount_partners;
CREATE POLICY "discount_partners_select_active"
  ON public.discount_partners FOR SELECT
  USING (is_active = true OR (auth.role() = 'authenticated'));

DROP POLICY IF EXISTS "discount_partners_admin_all" ON public.discount_partners;
CREATE POLICY "discount_partners_admin_all"
  ON public.discount_partners FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas RLS para partner_leads
DROP POLICY IF EXISTS "partner_leads_select_own" ON public.partner_leads;
CREATE POLICY "partner_leads_select_own"
  ON public.partner_leads FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "partner_leads_insert_auth" ON public.partner_leads;
CREATE POLICY "partner_leads_insert_auth"
  ON public.partner_leads FOR INSERT TO authenticated
  WITH CHECK (true);

-- Seed de parceiros iniciais para demonstração e teste do catálogo
INSERT INTO public.discount_partners (id, name, category, discount_rules, promocodes, logo_url, is_active)
VALUES
    ('d1111111-1111-4111-8111-111111111111', 'Smart Fit & Gyms', 'Saúde & Bem-Estar', 'Desconto de até 30% nas mensalidades do plano Black para colaboradores e dependentes.', ARRAY['SMARTHR30', 'FITBS2026'], 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=150&q=80', true),
    ('d2222222-2222-4222-8222-222222222222', 'Faculdade Descomplica', 'Educação', 'Bolsa de 45% em cursos de Pós-Graduação e MBA EaD para todo o quadro da Clínica BS.', ARRAY['DESCOMPLICABS45', 'POS2026BS'], 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=150&q=80', true),
    ('d3333333-3333-4333-8333-333333333333', 'Restaurante Sabor & Prosa', 'Alimentação', '15% de desconto no buffet executivo presencial apresentando o crachá ou voucher online.', ARRAY['SABORBS15'], 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=150&q=80', true),
    ('d4444444-4444-4444-8444-444444444444', 'Drogaria São Paulo / Pacheco', 'Saúde & Bem-Estar', 'Até 35% de desconto em medicamentos genéricos e 15% em perfumaria nas redes de balcão e app.', ARRAY['DROGABS35'], 'https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=150&q=80', true),
    ('d5555555-5555-4555-8555-555555555555', 'Cinemark & Lazer Prime', 'Lazer & Cultura', 'Ingressos corporativos com 50% de desconto em qualquer sala 2D e 3D de segunda a domingo.', ARRAY['CINEBS50', 'PIPOCABS'], 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=150&q=80', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    discount_rules = EXCLUDED.discount_rules,
    promocodes = EXCLUDED.promocodes,
    logo_url = EXCLUDED.logo_url,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
