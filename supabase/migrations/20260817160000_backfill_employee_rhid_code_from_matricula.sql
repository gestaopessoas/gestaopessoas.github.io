-- RHID inicia igual à matrícula (mesmo código, campo próprio e editável).
-- Só preenche onde ainda está vazio, para não sobrescrever edições futuras.
UPDATE public.employees
SET rhid_code = registration_number
WHERE rhid_code IS NULL
  AND registration_number IS NOT NULL;
