-- Vaga excluída continuava pública em /carreiras e aceitando candidatura.
--
-- Excluir uma requisição (`job_requests`) é hard delete. O trigger que mantém
-- `job_openings` em dia (`sync_approved_job_request_to_opening`) só cobre
-- INSERT/UPDATE, e a FK `job_openings_job_request_id_fkey` é ON DELETE SET NULL:
-- o vínculo some, o `status` fica 'Aberta' para sempre. `get_public_careers()` e a
-- policy `job_openings_public_select` filtram só por status, então a vaga continuava
-- listada e a página de detalhe continuava resolvendo.
--
-- BEFORE DELETE é obrigatório: depois do DELETE a FK já zerou `job_request_id` e não
-- há mais como localizar a vaga correspondente.

CREATE OR REPLACE FUNCTION public.close_job_opening_on_job_request_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.job_openings
  SET status = 'Fechada'
  WHERE job_request_id = OLD.id
    AND status <> 'Fechada';

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.close_job_opening_on_job_request_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_close_job_opening_on_job_request_delete ON public.job_requests;
CREATE TRIGGER trg_close_job_opening_on_job_request_delete
BEFORE DELETE ON public.job_requests
FOR EACH ROW
EXECUTE FUNCTION public.close_job_opening_on_job_request_delete();

-- Backfill único das vagas que já ficaram órfãs em exclusões feitas antes deste trigger.
-- `job_request_id IS NULL` é o rastro que a FK ON DELETE SET NULL deixa. Toda linha de
-- `job_openings` nasce com vínculo — tanto o trigger de sync quanto o backfill de
-- 20260814191855 sempre preenchem `job_request_id` —, então NULL aqui só acontece
-- quando a requisição de origem foi excluída.
UPDATE public.job_openings
SET status = 'Fechada'
WHERE job_request_id IS NULL
  AND status = 'Aberta';
