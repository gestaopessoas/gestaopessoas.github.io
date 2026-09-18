-- Issue #137: o recorte redondo da foto de perfil.
--
-- Sobe um arquivo so, o original. O recorte e guardado como coordenadas, nao como segundo
-- arquivo: reenquadrar vira um UPDATE de quatro numeros, sem reupload e sem perder qualidade
-- a cada ajuste, e o original continua inteiro no bucket, que e o que o RH quer ter em maos.
--
-- {x, y, width, height} em PORCENTAGEM -- a mesma unidade que o react-image-crop devolve com
-- unit: "%". NULL = imagem centralizada sem recorte, que e o estado de toda foto enviada ate
-- hoje; a tela nao pode quebrar nesse caso.
--
-- ROLLBACK:
--   ALTER TABLE public.employees DROP COLUMN photo_crop;
--   ALTER TABLE arquivo.employees DROP COLUMN photo_crop;
--   (e recriar a view e o gatilho sem photo_crop, como ficaram em 20260918090000)

ALTER TABLE public.employees  ADD COLUMN IF NOT EXISTS photo_crop jsonb;
ALTER TABLE arquivo.employees ADD COLUMN IF NOT EXISTS photo_crop jsonb;

COMMENT ON COLUMN public.employees.photo_crop IS
  'Recorte da foto de perfil em porcentagem: {"x":..,"y":..,"width":..,"height":..}. NULL = sem recorte.';

CREATE OR REPLACE VIEW public.employees_todos WITH (security_invoker = on) AS
  SELECT * FROM public.employees
  UNION ALL
  SELECT * FROM arquivo.employees;

-- Mesma razao da 20260918090000: o reenquadramento vem da ficha, que grava por
-- employees_todos. Fora desta lista, o UPDATE do recorte seria descartado em silencio.
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
    department, ficha, rhid_code, company_anniversary, photo_path, photo_crop
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
    NEW.company_anniversary, NEW.photo_path, NEW.photo_crop
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
      department, ficha, rhid_code, company_anniversary, photo_path, photo_crop
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
      NEW.company_anniversary, NEW.photo_path, NEW.photo_crop
    ) WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END; $fn$;
-- A auditoria (public.log_employee_changes e a gemea arquivo.log_employee_changes) varre TODA
-- coluna da tabela e grava o antes/depois em employee_history_value_entries.
-- Aqui nao e so ruido: employee_history_value_entries tem CHECK aceitando apenas
-- string/number/boolean/null em value_type. Um jsonb object cai como 'object' e viola a
-- constraint -- ou seja, sem esta exclusao QUALQUER edicao de colaborador que mexesse no
-- recorte falharia inteira. Medido no banco local antes de escrever esta linha.
-- Reescreve a lista de colunas ignoradas na definicao que estiver no banco, em vez de repetir
-- as duas funcoes inteiras aqui: elas ja divergiram uma da outra uma vez, e copiar o corpo
-- congelaria a versao de hoje por cima do que existir la.
DO $mig$
DECLARE
  f text;
  d text;
  antes  text := $q$NOT IN ('id', 'updated_at', 'created_at', 'photo_path'$q$;
  depois text := $q$NOT IN ('id', 'updated_at', 'created_at', 'photo_path', 'photo_crop'$q$;
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

-- O colaborador enquadra a foto na propria tela de envio, antes de mandar. Como /enviar-foto
-- e publica, o recorte tem que entrar pela mesma funcao que ja grava o caminho -- por uma
-- chamada so, senao uma foto nova poderia ficar com o recorte da anterior no meio do caminho.
-- Trocar a assinatura exige DROP: CREATE OR REPLACE com parametro novo criaria uma sobrecarga
-- e a versao de dois argumentos continuaria de pe.
DROP FUNCTION IF EXISTS public.set_employee_photo(uuid, text);

CREATE OR REPLACE FUNCTION public.set_employee_photo(p_employee uuid, p_path text, p_crop jsonb DEFAULT NULL)
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

  -- Recorte e sempre {x, y, width, height} numericos em porcentagem, ou nada. Guardar jsonb
  -- de forma qualquer faria a tela de exibicao ter que se defender de cada formato possivel.
  IF p_crop IS NOT NULL AND NOT (
       jsonb_typeof(p_crop) = 'object'
       AND jsonb_typeof(p_crop->'x') = 'number' AND jsonb_typeof(p_crop->'y') = 'number'
       AND jsonb_typeof(p_crop->'width') = 'number' AND jsonb_typeof(p_crop->'height') = 'number'
       AND (p_crop->>'width')::numeric > 0 AND (p_crop->>'height')::numeric > 0
     ) THEN
    RAISE EXCEPTION 'recorte invalido: esperado {x, y, width, height} em porcentagem';
  END IF;

  UPDATE public.employees SET photo_path = p_path, photo_crop = p_crop WHERE id = p_employee
    RETURNING user_id INTO v_user;

  IF NOT FOUND THEN
    UPDATE arquivo.employees SET photo_path = p_path, photo_crop = p_crop WHERE id = p_employee
      RETURNING user_id INTO v_user;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'colaborador nao encontrado';
    END IF;
  END IF;

  IF v_user IS NOT NULL THEN
    UPDATE public.profiles SET avatar_url = p_path WHERE id = v_user;
  END IF;
END; $fn$;

REVOKE ALL ON FUNCTION public.set_employee_photo(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_employee_photo(uuid, text, jsonb) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
