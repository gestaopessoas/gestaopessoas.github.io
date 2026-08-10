-- Add visual options for partner logos
ALTER TABLE public.discount_partners 
ADD COLUMN IF NOT EXISTS logo_position TEXT DEFAULT 'center',
ADD COLUMN IF NOT EXISTS logo_dark_mask BOOLEAN DEFAULT false;
