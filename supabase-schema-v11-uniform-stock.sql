-- Tabela de estoque de uniformes disponíveis (catálogo geral)
CREATE TABLE IF NOT EXISTS public.uniform_stock (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL,       -- 'POLO', 'BLUSÃO', 'CAMISA SOCIAL FEMININO', etc.
  size text NOT NULL,           -- 'PP', 'P', 'M', 'G', 'GG', '36', etc.
  available integer DEFAULT 0,  -- Total disponível
  qty_taken integer DEFAULT 0,  -- Quantidade retirada
  stock integer DEFAULT 0,      -- Estoque atual
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.uniform_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for uniform_stock" ON public.uniform_stock FOR ALL USING (true) WITH CHECK (true);
