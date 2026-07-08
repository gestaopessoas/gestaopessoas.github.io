create table if not exists public.rgs_processes (
  id uuid default gen_random_uuid() primary key,
  process_type text not null,
  process_date date,
  employee_name text,
  role text,
  contract_type text,
  location text,
  sector text,
  effective_date date,
  exam_date date,
  sst_status text,
  description text,
  status text default 'Pendente',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS e criar política de anon
alter table public.rgs_processes enable row level security;
create policy "Allow all operations for anon on rgs" on public.rgs_processes for all using (true) with check (true);
