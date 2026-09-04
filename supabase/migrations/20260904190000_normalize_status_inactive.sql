-- ROLLBACK:
--   UPDATE public.employees e SET status = 'inactive'
--     FROM public._backup_20260904_status_inactive b WHERE b.employee_id = e.id;
--   CREATE OR REPLACE VIEW public.employees_arquivo_morto ... WHERE status = 'inactive';
--   (a definição anterior da view está reproduzida no fim deste arquivo, comentada)
--
-- Normaliza o status legado em inglês.
--
-- A base tem os dois grafados lado a lado: 4.505 linhas em 'inactive' (minúsculo,
-- vindo da migração antiga) e 1 em 'Inativo' (o que o formulário grava hoje). Por
-- isso todo filtro do sistema precisa listar as duas formas — ver INACTIVE_STATUSES,
-- HIDDEN_STATUSES e ARCHIVE_STATUSES no código, e a armadilha já registrada em
-- docs/manutencao.md. Um valor a menos é um esquecimento a menos.
--
-- Esta migration NÃO promove ninguém para o status 'Arquivo Morto'. A tela
-- /dashboard/arquivo-morto busca por ARCHIVE_STATUSES = ['Inativo','Desligado',
-- 'inactive'], que não inclui 'Arquivo Morto': quem recebesse esse status sumiria
-- justamente da tela feita para mostrá-lo. Depois do rename as 4.505 pessoas
-- continuam aparecendo lá, agora como 'Inativo'.

-- Guarda quem foi alterado, para o rollback ser exato (a linha que já era 'Inativo'
-- antes não pode voltar para 'inactive'). Pode ser dropada quando a mudança estiver
-- validada em produção.
CREATE TABLE IF NOT EXISTS public._backup_20260904_status_inactive (
  employee_id uuid PRIMARY KEY
);

COMMENT ON TABLE public._backup_20260904_status_inactive IS
  'Ids que tinham status = ''inactive'' antes da normalização de 2026-09-04. Só serve para o rollback; pode ser dropada.';

ALTER TABLE public._backup_20260904_status_inactive ENABLE ROW LEVEL SECURITY;
-- Sem policy: tabela de manutenção, ninguém lê pela API.

INSERT INTO public._backup_20260904_status_inactive (employee_id)
SELECT id FROM public.employees WHERE status = 'inactive'
ON CONFLICT (employee_id) DO NOTHING;

UPDATE public.employees SET status = 'Inativo' WHERE status = 'inactive';

-- A view aponta para o valor antigo e ficaria vazia depois do UPDATE.
-- Nenhuma tela do app a consulta hoje, mas ela existe no schema desde o baseline.
-- A lista de 51 colunas e reproduzida na integra de proposito: CREATE OR REPLACE VIEW
-- so aceita acrescentar coluna no fim, nunca remover nem reordenar. Um SELECT * traria
-- a ordem da tabela, que ja nao e a da view, e o comando falharia com "cannot drop
-- columns from view".
--
-- A lista veio da view VIVA (via OpenAPI do PostgREST), nao do baseline: o baseline
-- esta defasado e ainda lista onboarding_status, coluna removida de employees pela
-- migration 20260814202133_normalize_employee_onboarding_tasks.
CREATE OR REPLACE VIEW public.employees_arquivo_morto WITH (security_invoker = on) AS
  SELECT
    id,
    name,
    department_id,
    birthday,
    created_at,
    status,
    dismissed_at,
    role,
    phone,
    email_personal,
    email_corporate,
    contract_type,
    admission_date,
    shirt_size,
    gender,
    unit,
    cpf,
    rg,
    ctps,
    ctps_serie,
    pis,
    marital_status,
    cost_center,
    cbo,
    aso_date,
    observation,
    workplace,
    updated_at,
    level,
    company_id,
    cost_center_id,
    workplace_id,
    registration_number,
    boot_size,
    profile_code,
    work_schedule_start_1,
    work_schedule_end_1,
    work_schedule_start_2,
    work_schedule_end_2,
    weekly_hours,
    work_days,
    base_salary,
    variable_salary,
    commission,
    encargos,
    seniority,
    user_id,
    senioridade,
    sector_id,
    department,
    ficha
  FROM public.employees
  WHERE status = 'Inativo';

DO $$
DECLARE
  restantes integer;
BEGIN
  SELECT count(*) INTO restantes FROM public.employees WHERE status = 'inactive';
  IF restantes > 0 THEN
    RAISE EXCEPTION 'Ainda restam % colaboradores em ''inactive''', restantes;
  END IF;
END $$;

-- Definição anterior da view, para o rollback:
--
-- CREATE OR REPLACE VIEW public.employees_arquivo_morto WITH (security_invoker = on) AS
--   SELECT <as mesmas 48 colunas listadas acima>
--   FROM public.employees
--   WHERE status = 'inactive';
