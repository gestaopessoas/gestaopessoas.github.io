-- Remove a coluna obsoleta archive_box, pois a lógica de Arquivo Morto
-- foi substituída pelas tabelas physical_boxes e employee_archives.

ALTER TABLE public.employees DROP COLUMN IF EXISTS archive_box;
