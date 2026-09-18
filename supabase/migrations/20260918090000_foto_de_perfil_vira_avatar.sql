-- Issue #135: a foto enviada em /enviar-foto?tipo=perfil vira a foto oficial da pessoa.
--
-- Hoje ela so entra numa lista de arquivos com botao "Ver" na ficha. public.employees nao
-- tem coluna de foto, e public.profiles.avatar_url existe no banco desde o baseline mas nao
-- e lido nem escrito em lugar nenhum do src/.
--
-- Guarda o CAMINHO no bucket, nao a URL: employee-photos e privado e a URL assinada expira
-- em segundos. Quem exibe gera a URL na hora.
--
-- ROLLBACK:
--   DROP FUNCTION public.set_employee_photo(uuid, text);
--   ALTER TABLE public.employees DROP COLUMN photo_path;
--   ALTER TABLE arquivo.employees DROP COLUMN photo_path;
--   (e recriar a view e o gatilho sem photo_path, como estao em 20260908120100)

ALTER TABLE public.employees  ADD COLUMN IF NOT EXISTS photo_path text;
ALTER TABLE arquivo.employees ADD COLUMN IF NOT EXISTS photo_path text;

COMMENT ON COLUMN public.employees.photo_path IS
  'Caminho no bucket employee-photos da foto que vale como avatar. NULL = mostra as iniciais.';

-- A view e UNION ALL de SELECT *: precisa ser recriada para enxergar a coluna nova.
CREATE OR REPLACE VIEW public.employees_todos WITH (security_invoker = on) AS
  SELECT * FROM public.employees
  UNION ALL
  SELECT * FROM arquivo.employees;

-- O gatilho INSTEAD OF lista as colunas uma a uma. Sem photo_path aqui, o UPDATE que vem da
-- ficha por employees_todos gravaria tudo menos a foto, e sem erro nenhum na tela.
CREATE OR REPLACE FUNCTION public.employees_todos_escrita()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, arquivo, pg_temp
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Cadastro novo nasce no quadro atual. Vai para o arquivo quando for desligado.
    INSERT INTO public.employees VALUES (NEW.*);
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.employees WHERE id = OLD.id;
    IF NOT FOUND THEN DELETE FROM arquivo.employees WHERE id = OLD.id; END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: escreve onde a pessoa esta.
  UPDATE public.employees SET (
    name, department_id, birthday, created_at, status, dismissed_at, role, phone,
    email_personal, email_corporate, contract_type, admission_date, shirt_size, gender,
    unit, cpf, rg, ctps, ctps_serie, pis, marital_status, cost_center, cbo, aso_date,
    observation, workplace, updated_at, level, company_id, cost_center_id, workplace_id,
    registration_number, boot_size, profile_code, work_schedule_start_1, work_schedule_end_1,
    work_schedule_start_2, work_schedule_end_2, weekly_hours, work_days, base_salary,
    variable_salary, commission, encargos, seniority, user_id, senioridade, sector_id,
    department, ficha, rhid_code, company_anniversary, photo_path
  ) = (
    NEW.name, NEW.department_id, NEW.birthday, NEW.created_at, NEW.status, NEW.dismissed_at,
    NEW.role, NEW.phone, NEW.email_personal, NEW.email_corporate, NEW.contract_type,
    NEW.admission_date, NEW.shirt_size, NEW.gender, NEW.unit, NEW.cpf, NEW.rg, NEW.ctps,
    NEW.ctps_serie, NEW.pis, NEW.marital_status, NEW.cost_center, NEW.cbo, NEW.aso_date,
    NEW.observation, NEW.workplace, NEW.updated_at, NEW.level, NEW.company_id,
    NEW.cost_center_id, NEW.workplace_id, NEW.registration_number, NEW.boot_size,
    NEW.profile_code, NEW.work_schedule_start_1, NEW.work_schedule_end_1,
    NEW.work_schedule_start_2, NEW.work_schedule_end_2, NEW.weekly_hours, NEW.work_days,
    NEW.base_salary, NEW.variable_salary, NEW.commission, NEW.encargos, NEW.seniority,
    NEW.user_id, NEW.senioridade, NEW.sector_id, NEW.department, NEW.ficha, NEW.rhid_code,
    NEW.company_anniversary, NEW.photo_path
  ) WHERE id = NEW.id;

  IF NOT FOUND THEN
    UPDATE arquivo.employees SET (
      name, department_id, birthday, created_at, status, dismissed_at, role, phone,
      email_personal, email_corporate, contract_type, admission_date, shirt_size, gender,
      unit, cpf, rg, ctps, ctps_serie, pis, marital_status, cost_center, cbo, aso_date,
      observation, workplace, updated_at, level, company_id, cost_center_id, workplace_id,
      registration_number, boot_size, profile_code, work_schedule_start_1, work_schedule_end_1,
      work_schedule_start_2, work_schedule_end_2, weekly_hours, work_days, base_salary,
      variable_salary, commission, encargos, seniority, user_id, senioridade, sector_id,
      department, ficha, rhid_code, company_anniversary, photo_path
    ) = (
      NEW.name, NEW.department_id, NEW.birthday, NEW.created_at, NEW.status, NEW.dismissed_at,
      NEW.role, NEW.phone, NEW.email_personal, NEW.email_corporate, NEW.contract_type,
      NEW.admission_date, NEW.shirt_size, NEW.gender, NEW.unit, NEW.cpf, NEW.rg, NEW.ctps,
      NEW.ctps_serie, NEW.pis, NEW.marital_status, NEW.cost_center, NEW.cbo, NEW.aso_date,
      NEW.observation, NEW.workplace, NEW.updated_at, NEW.level, NEW.company_id,
      NEW.cost_center_id, NEW.workplace_id, NEW.registration_number, NEW.boot_size,
      NEW.profile_code, NEW.work_schedule_start_1, NEW.work_schedule_end_1,
      NEW.work_schedule_start_2, NEW.work_schedule_end_2, NEW.weekly_hours, NEW.work_days,
      NEW.base_salary, NEW.variable_salary, NEW.commission, NEW.encargos, NEW.seniority,
      NEW.user_id, NEW.senioridade, NEW.sector_id, NEW.department, NEW.ficha, NEW.rhid_code,
      NEW.company_anniversary, NEW.photo_path
    ) WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END; $fn$;

-- A auditoria (public.log_employee_changes e a gemea arquivo.log_employee_changes) varre TODA
-- coluna da tabela e grava o antes/depois em employee_history_value_entries.
-- Trocar a foto nao e alteracao cadastral: sem esta exclusao, cada envio de foto viraria
-- uma linha "Alteracao em photo_path" na linha do tempo do colaborador.
-- Reescreve a lista de colunas ignoradas na definicao que estiver no banco, em vez de repetir
-- as duas funcoes inteiras aqui: elas ja divergiram uma da outra uma vez, e copiar o corpo
-- congelaria a versao de hoje por cima do que existir la.
DO $mig$
DECLARE
  f text;
  d text;
  antes  text := $q$NOT IN ('id', 'updated_at', 'created_at'$q$;
  depois text := $q$NOT IN ('id', 'updated_at', 'created_at', 'photo_path'$q$;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.log_employee_changes', 'arquivo.log_employee_changes'] LOOP
    d := pg_get_functiondef(f::regproc);
    CONTINUE WHEN position(depois in d) > 0;  -- ja aplicado
    IF position(antes in d) = 0 THEN
      RAISE EXCEPTION 'nao achei a lista de colunas ignoradas em %', f;
    END IF;
    EXECUTE replace(d, antes, depois);
  END LOOP;
END $mig$;

-- /enviar-foto e tela publica: o colaborador abre o link no celular, sem login. A policy
-- employees_no_anon (USING false) barra qualquer escrita anonima em employees, e e para
-- continuar assim -- por isso a gravacao passa por esta funcao, e nao por uma policy de
-- UPDATE aberta para anon.
--
-- A funcao so aceita caminho dentro da pasta de perfil do proprio colaborador. Quem tem o
-- UUID ja podia subir foto de perfil daquela pessoa (e o desenho do link enviado pelo RH);
-- isto nao amplia essa superficie, so impede apontar o avatar para caminho arbitrario.
CREATE OR REPLACE FUNCTION public.set_employee_photo(p_employee uuid, p_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, arquivo, pg_temp
AS $fn$
DECLARE v_user uuid;
BEGIN
  IF p_path IS NULL OR p_path !~ ('^' || p_employee::text || '/perfil/[A-Za-z0-9._-]+$') THEN
    RAISE EXCEPTION 'caminho de foto fora da pasta de perfil do colaborador';
  END IF;

  UPDATE public.employees SET photo_path = p_path WHERE id = p_employee
    RETURNING user_id INTO v_user;

  IF NOT FOUND THEN
    UPDATE arquivo.employees SET photo_path = p_path WHERE id = p_employee
      RETURNING user_id INTO v_user;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'colaborador nao encontrado';
    END IF;
  END IF;

  -- Com login, a mesma foto vira o avatar do menu do topo. Sem login, v_user e NULL e so
  -- employees fica com a referencia.
  IF v_user IS NOT NULL THEN
    UPDATE public.profiles SET avatar_url = p_path WHERE id = v_user;
  END IF;
END; $fn$;

REVOKE ALL ON FUNCTION public.set_employee_photo(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_employee_photo(uuid, text) TO anon, authenticated;

-- PostgREST guarda o schema em cache; sem isto a coluna nova so aparece no proximo restart.
NOTIFY pgrst, 'reload schema';
