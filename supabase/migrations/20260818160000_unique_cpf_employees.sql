create unique index if not exists employees_cpf_unique
  on public.employees (cpf)
  where cpf is not null and cpf <> '';
