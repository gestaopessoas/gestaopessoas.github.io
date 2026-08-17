-- Campo "Código do RHID" no cadastro do colaborador (Documentos e arquivo),
-- editável e distinto da matrícula (registration_number) já usada para
-- casar com o arquivo de exportação do relógio de ponto RHID.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS rhid_code text;
