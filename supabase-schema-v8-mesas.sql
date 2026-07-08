-- Adicionar colunas de setor e posição para o mapa visual
ALTER TABLE public.islands ADD COLUMN IF NOT EXISTS sector text;
ALTER TABLE public.islands ADD COLUMN IF NOT EXISTS position_index integer;
