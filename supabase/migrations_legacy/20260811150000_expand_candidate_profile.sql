-- Informações Pessoais
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS marital_status TEXT,
  ADD COLUMN IF NOT EXISTS birthplace TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS secondary_phone TEXT,
  ADD COLUMN IF NOT EXISTS secondary_email TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;

-- Informações Adicionais
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS salary_expectation TEXT,
  ADD COLUMN IF NOT EXISTS has_cnh BOOLEAN,
  ADD COLUMN IF NOT EXISTS cnh_categories TEXT[],
  ADD COLUMN IF NOT EXISTS has_dependents BOOLEAN,
  ADD COLUMN IF NOT EXISTS dependents_count INTEGER,
  ADD COLUMN IF NOT EXISTS dependents_notes TEXT,
  ADD COLUMN IF NOT EXISTS uniform_size TEXT,
  ADD COLUMN IF NOT EXISTS boot_size TEXT;

-- Diversidade
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS gender_identity TEXT,
  ADD COLUMN IF NOT EXISTS sexual_orientation TEXT,
  ADD COLUMN IF NOT EXISTS race_declaration TEXT;

-- Tabela de documentos do checklist de admissão
CREATE TABLE IF NOT EXISTS public.candidate_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente',
    file_url TEXT,
    notes TEXT,
    updated_by TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can all candidate_documents"
  ON public.candidate_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_candidate_documents_candidate_id
  ON public.candidate_documents (candidate_id);
