-- Migration: Universal Uppercase Normalization & Data Sanitization
-- Description: Creates BEFORE INSERT OR UPDATE triggers to automatically transform entity names, roles, departments, and titles into UPPERCASE (and emails to lowercase), protecting URLs and enum statuses.
-- Also runs immediate batch cleanup on existing database rows that deviate from this standard.

-- 1. EMPLOYEES
CREATE OR REPLACE FUNCTION public.fn_normalize_employees()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN NEW.name := UPPER(TRIM(NEW.name)); END IF;
  IF NEW.role IS NOT NULL THEN NEW.role := UPPER(TRIM(NEW.role)); END IF;
  IF NEW.cost_center IS NOT NULL THEN NEW.cost_center := UPPER(TRIM(NEW.cost_center)); END IF;
  IF NEW.unit IS NOT NULL THEN NEW.unit := UPPER(TRIM(NEW.unit)); END IF;
  IF NEW.workplace IS NOT NULL THEN NEW.workplace := UPPER(TRIM(NEW.workplace)); END IF;
  IF NEW.seniority IS NOT NULL THEN NEW.seniority := UPPER(TRIM(NEW.seniority)); END IF;
  IF NEW.email_corporate IS NOT NULL THEN NEW.email_corporate := LOWER(TRIM(NEW.email_corporate)); END IF;
  IF NEW.email_personal IS NOT NULL THEN NEW.email_personal := LOWER(TRIM(NEW.email_personal)); END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_employees ON public.employees;
CREATE TRIGGER trg_normalize_employees
  BEFORE INSERT OR UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_normalize_employees();

-- 2. CANDIDATES
CREATE OR REPLACE FUNCTION public.fn_normalize_candidates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.first_name IS NOT NULL THEN NEW.first_name := UPPER(TRIM(NEW.first_name)); END IF;
  IF NEW.last_name IS NOT NULL THEN NEW.last_name := UPPER(TRIM(NEW.last_name)); END IF;
  IF NEW.full_name IS NOT NULL THEN NEW.full_name := UPPER(TRIM(NEW.full_name)); END IF;
  IF NEW.city IS NOT NULL THEN NEW.city := UPPER(TRIM(NEW.city)); END IF;
  IF NEW.state IS NOT NULL THEN NEW.state := UPPER(TRIM(NEW.state)); END IF;
  IF NEW.role_interest IS NOT NULL THEN NEW.role_interest := UPPER(TRIM(NEW.role_interest)); END IF;
  IF NEW.email IS NOT NULL THEN NEW.email := LOWER(TRIM(NEW.email)); END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_candidates ON public.candidates;
CREATE TRIGGER trg_normalize_candidates
  BEFORE INSERT OR UPDATE ON public.candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_normalize_candidates();

-- 3. DISCOUNT PARTNERS
CREATE OR REPLACE FUNCTION public.fn_normalize_discount_partners()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN NEW.name := UPPER(TRIM(NEW.name)); END IF;
  IF NEW.category IS NOT NULL THEN NEW.category := UPPER(TRIM(NEW.category)); END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_discount_partners ON public.discount_partners;
CREATE TRIGGER trg_normalize_discount_partners
  BEFORE INSERT OR UPDATE ON public.discount_partners
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_normalize_discount_partners();

-- 4. COMPANY & EMPLOYEE BENEFITS
CREATE OR REPLACE FUNCTION public.fn_normalize_company_benefits()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN NEW.name := UPPER(TRIM(NEW.name)); END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_company_benefits ON public.company_benefits;
CREATE TRIGGER trg_normalize_company_benefits
  BEFORE INSERT OR UPDATE ON public.company_benefits
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_normalize_company_benefits();

CREATE OR REPLACE FUNCTION public.fn_normalize_employee_benefits()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.benefit_name IS NOT NULL THEN NEW.benefit_name := UPPER(TRIM(NEW.benefit_name)); END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_employee_benefits ON public.employee_benefits;
CREATE TRIGGER trg_normalize_employee_benefits
  BEFORE INSERT OR UPDATE ON public.employee_benefits
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_normalize_employee_benefits();

-- 5. PROFILES
CREATE OR REPLACE FUNCTION public.fn_normalize_profiles()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN NEW.name := UPPER(TRIM(NEW.name)); END IF;
  IF NEW.full_name IS NOT NULL THEN NEW.full_name := UPPER(TRIM(NEW.full_name)); END IF;
  IF NEW.role IS NOT NULL THEN NEW.role := UPPER(TRIM(NEW.role)); END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_profiles ON public.profiles;
CREATE TRIGGER trg_normalize_profiles
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_normalize_profiles();

-- 6. RGS PROCESSES
CREATE OR REPLACE FUNCTION public.fn_normalize_rgs_processes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_name IS NOT NULL THEN NEW.employee_name := UPPER(TRIM(NEW.employee_name)); END IF;
  IF NEW.role IS NOT NULL THEN NEW.role := UPPER(TRIM(NEW.role)); END IF;
  IF NEW.sector IS NOT NULL THEN NEW.sector := UPPER(TRIM(NEW.sector)); END IF;
  IF NEW.location IS NOT NULL THEN NEW.location := UPPER(TRIM(NEW.location)); END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_rgs_processes ON public.rgs_processes;
CREATE TRIGGER trg_normalize_rgs_processes
  BEFORE INSERT OR UPDATE ON public.rgs_processes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_normalize_rgs_processes();

-- ============================================================================
-- DATA SANITIZATION / RETROACTIVE CLEANUP OF EXISTING RECORDS
-- ============================================================================

UPDATE public.employees
SET
  name = CASE WHEN name IS NOT NULL THEN UPPER(TRIM(name)) ELSE name END,
  role = CASE WHEN role IS NOT NULL THEN UPPER(TRIM(role)) ELSE role END,
  cost_center = CASE WHEN cost_center IS NOT NULL THEN UPPER(TRIM(cost_center)) ELSE cost_center END,
  unit = CASE WHEN unit IS NOT NULL THEN UPPER(TRIM(unit)) ELSE unit END,
  workplace = CASE WHEN workplace IS NOT NULL THEN UPPER(TRIM(workplace)) ELSE workplace END,
  seniority = CASE WHEN seniority IS NOT NULL THEN UPPER(TRIM(seniority)) ELSE seniority END,
  email_corporate = CASE WHEN email_corporate IS NOT NULL THEN LOWER(TRIM(email_corporate)) ELSE email_corporate END,
  email_personal = CASE WHEN email_personal IS NOT NULL THEN LOWER(TRIM(email_personal)) ELSE email_personal END
WHERE
  (name IS NOT NULL AND name IS DISTINCT FROM UPPER(TRIM(name))) OR
  (role IS NOT NULL AND role IS DISTINCT FROM UPPER(TRIM(role))) OR
  (cost_center IS NOT NULL AND cost_center IS DISTINCT FROM UPPER(TRIM(cost_center))) OR
  (unit IS NOT NULL AND unit IS DISTINCT FROM UPPER(TRIM(unit))) OR
  (workplace IS NOT NULL AND workplace IS DISTINCT FROM UPPER(TRIM(workplace))) OR
  (seniority IS NOT NULL AND seniority IS DISTINCT FROM UPPER(TRIM(seniority))) OR
  (email_corporate IS NOT NULL AND email_corporate IS DISTINCT FROM LOWER(TRIM(email_corporate))) OR
  (email_personal IS NOT NULL AND email_personal IS DISTINCT FROM LOWER(TRIM(email_personal)));

UPDATE public.candidates
SET
  first_name = CASE WHEN first_name IS NOT NULL THEN UPPER(TRIM(first_name)) ELSE first_name END,
  last_name = CASE WHEN last_name IS NOT NULL THEN UPPER(TRIM(last_name)) ELSE last_name END,
  full_name = CASE WHEN full_name IS NOT NULL THEN UPPER(TRIM(full_name)) ELSE full_name END,
  city = CASE WHEN city IS NOT NULL THEN UPPER(TRIM(city)) ELSE city END,
  state = CASE WHEN state IS NOT NULL THEN UPPER(TRIM(state)) ELSE state END,
  role_interest = CASE WHEN role_interest IS NOT NULL THEN UPPER(TRIM(role_interest)) ELSE role_interest END,
  email = CASE WHEN email IS NOT NULL THEN LOWER(TRIM(email)) ELSE email END
WHERE
  (first_name IS NOT NULL AND first_name IS DISTINCT FROM UPPER(TRIM(first_name))) OR
  (last_name IS NOT NULL AND last_name IS DISTINCT FROM UPPER(TRIM(last_name))) OR
  (full_name IS NOT NULL AND full_name IS DISTINCT FROM UPPER(TRIM(full_name))) OR
  (city IS NOT NULL AND city IS DISTINCT FROM UPPER(TRIM(city))) OR
  (state IS NOT NULL AND state IS DISTINCT FROM UPPER(TRIM(state))) OR
  (role_interest IS NOT NULL AND role_interest IS DISTINCT FROM UPPER(TRIM(role_interest))) OR
  (email IS NOT NULL AND email IS DISTINCT FROM LOWER(TRIM(email)));

UPDATE public.discount_partners
SET
  name = CASE WHEN name IS NOT NULL THEN UPPER(TRIM(name)) ELSE name END,
  category = CASE WHEN category IS NOT NULL THEN UPPER(TRIM(category)) ELSE category END
WHERE
  (name IS NOT NULL AND name IS DISTINCT FROM UPPER(TRIM(name))) OR
  (category IS NOT NULL AND category IS DISTINCT FROM UPPER(TRIM(category)));

UPDATE public.company_benefits
SET name = CASE WHEN name IS NOT NULL THEN UPPER(TRIM(name)) ELSE name END
WHERE name IS NOT NULL AND name IS DISTINCT FROM UPPER(TRIM(name));

UPDATE public.employee_benefits
SET benefit_name = CASE WHEN benefit_name IS NOT NULL THEN UPPER(TRIM(benefit_name)) ELSE benefit_name END
WHERE benefit_name IS NOT NULL AND benefit_name IS DISTINCT FROM UPPER(TRIM(benefit_name));

UPDATE public.profiles
SET
  name = CASE WHEN name IS NOT NULL THEN UPPER(TRIM(name)) ELSE name END,
  full_name = CASE WHEN full_name IS NOT NULL THEN UPPER(TRIM(full_name)) ELSE full_name END,
  role = CASE WHEN role IS NOT NULL THEN UPPER(TRIM(role)) ELSE role END
WHERE
  (name IS NOT NULL AND name IS DISTINCT FROM UPPER(TRIM(name))) OR
  (full_name IS NOT NULL AND full_name IS DISTINCT FROM UPPER(TRIM(full_name))) OR
  (role IS NOT NULL AND role IS DISTINCT FROM UPPER(TRIM(role)));

UPDATE public.rgs_processes
SET
  employee_name = CASE WHEN employee_name IS NOT NULL THEN UPPER(TRIM(employee_name)) ELSE employee_name END,
  role = CASE WHEN role IS NOT NULL THEN UPPER(TRIM(role)) ELSE role END,
  sector = CASE WHEN sector IS NOT NULL THEN UPPER(TRIM(sector)) ELSE sector END,
  location = CASE WHEN location IS NOT NULL THEN UPPER(TRIM(location)) ELSE location END
WHERE
  (employee_name IS NOT NULL AND employee_name IS DISTINCT FROM UPPER(TRIM(employee_name))) OR
  (role IS NOT NULL AND role IS DISTINCT FROM UPPER(TRIM(role))) OR
  (sector IS NOT NULL AND sector IS DISTINCT FROM UPPER(TRIM(sector))) OR
  (location IS NOT NULL AND location IS DISTINCT FROM UPPER(TRIM(location)));
