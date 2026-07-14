-- 1. Tabela de Caixas Físicas (Arquivo Morto)
CREATE TABLE public.physical_boxes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE, -- Ex: A01, M21, C04
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela de Endereçamento (Arquivo Morto -> Funcionário)
-- Quando um funcionário é desligado, ele pode ter documentos físicos guardados em uma caixa.
CREATE TABLE public.employee_archives (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  box_id uuid REFERENCES public.physical_boxes(id) ON DELETE RESTRICT,
  document_type text, -- Ex: "Prontuário Funcional", "Exames", "Rescisão"
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Configuração de Segurança (RLS - Row Level Security)
ALTER TABLE public.physical_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all actions for anon" ON public.physical_boxes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for anon" ON public.employee_archives FOR ALL USING (true) WITH CHECK (true);
