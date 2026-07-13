-- Migration: 00001_initial_schema.sql
-- Create extension for UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. companies
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cnpj VARCHAR(14) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    trading_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. workplaces
CREATE TABLE IF NOT EXISTS public.workplaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('OBRA', 'SEDE')),
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. cost_centers
CREATE TABLE IF NOT EXISTS public.cost_centers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. employees
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    cpf VARCHAR(11) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    company_id UUID REFERENCES public.companies(id) NOT NULL,
    workplace_id UUID REFERENCES public.workplaces(id) NOT NULL,
    cost_center_id UUID REFERENCES public.cost_centers(id) NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ON_LEAVE')),
    hire_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_companies_modtime
    BEFORE UPDATE ON public.companies
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_workplaces_modtime
    BEFORE UPDATE ON public.workplaces
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_cost_centers_modtime
    BEFORE UPDATE ON public.cost_centers
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_employees_modtime
    BEFORE UPDATE ON public.employees
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workplaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (Assuming authenticated users have full access for now)
CREATE POLICY "Allow authenticated users to read companies" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to read workplaces" ON public.workplaces FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to read cost_centers" ON public.cost_centers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to read employees" ON public.employees FOR SELECT TO authenticated USING (true);

-- Insert/Update/Delete policies
CREATE POLICY "Allow authenticated users to insert companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update companies" ON public.companies FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete companies" ON public.companies FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert workplaces" ON public.workplaces FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update workplaces" ON public.workplaces FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete workplaces" ON public.workplaces FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert cost_centers" ON public.cost_centers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update cost_centers" ON public.cost_centers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete cost_centers" ON public.cost_centers FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update employees" ON public.employees FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete employees" ON public.employees FOR DELETE TO authenticated USING (true);
