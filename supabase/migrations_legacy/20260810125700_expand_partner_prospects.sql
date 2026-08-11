-- Adiciona campos detalhados de proposta de parceria
ALTER TABLE public.partner_prospects 
ADD COLUMN IF NOT EXISTS discount_proposal TEXT,
ADD COLUMN IF NOT EXISTS how_to_use_proposal TEXT,
ADD COLUMN IF NOT EXISTS category_preference TEXT,
ADD COLUMN IF NOT EXISTS website_or_social TEXT;
