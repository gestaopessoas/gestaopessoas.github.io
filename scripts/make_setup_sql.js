const fs = require('fs');
let sql = fs.readFileSync('insert_data.sql', 'utf-8');

sql += `
-- Missing Tables Setup

CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.islands (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rgs_processes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id),
  process_type text NOT NULL,
  status text NOT NULL DEFAULT 'Pendente',
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.occupational_exams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id),
  exam_type text NOT NULL,
  exam_date date NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_benefits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id),
  benefit_name text NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_epis (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id),
  epi_name text NOT NULL,
  delivery_date date,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vacations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Default system settings for configuracoes page
INSERT INTO public.system_settings (setting_key, setting_value)
VALUES 
  ('modules', '{"ats": true, "admissao": true, "pdi": true, "gestor": true}'),
  ('permissions', '{"2fa": true, "salaries": false, "ai_notifications": true}')
ON CONFLICT (setting_key) DO NOTHING;
`;

fs.writeFileSync('setup_database.sql', sql, 'utf-8');
console.log('setup_database.sql created.');
