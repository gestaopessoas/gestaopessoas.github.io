-- Dados funcionais e ocupacionais não podem ser acessados sem login.
revoke all on table public.employees, public.departments, public.lockers,
  public.islands, public.rgs_processes, public.employee_benefits,
  public.employee_epis, public.vacations, public.occupational_exams from anon;

grant select, insert, update, delete on table public.employees, public.departments,
  public.lockers, public.islands, public.rgs_processes, public.employee_benefits,
  public.employee_epis, public.vacations, public.occupational_exams to authenticated;

drop policy if exists "Allow all" on public.employee_benefits;
drop policy if exists "Allow all operations for employee_benefits" on public.employee_benefits;
drop policy if exists "Allow all" on public.employee_epis;
drop policy if exists "Allow all operations for employee_epis" on public.employee_epis;
drop policy if exists "Allow all" on public.vacations;
drop policy if exists "Allow all operations for vacations" on public.vacations;
drop policy if exists "Allow all" on public.occupational_exams;
drop policy if exists "Allow all operations for occupational_exams" on public.occupational_exams;
drop policy if exists "Allow all operations for anon on rgs" on public.rgs_processes;
drop policy if exists "employee_benefits_read" on public.employee_benefits;
drop policy if exists "employee_benefits_write" on public.employee_benefits;
drop policy if exists "employee_epis_read" on public.employee_epis;
drop policy if exists "employee_epis_write" on public.employee_epis;
drop policy if exists "vacations_read" on public.vacations;
drop policy if exists "vacations_write" on public.vacations;
drop policy if exists "occupational_exams_read" on public.occupational_exams;
drop policy if exists "occupational_exams_write" on public.occupational_exams;
drop policy if exists "rgs_processes_read" on public.rgs_processes;
drop policy if exists "rgs_processes_write" on public.rgs_processes;

create policy "employee_benefits_read" on public.employee_benefits for select to authenticated
  using (public.can_access('colaboradores'::text, 'view'::text));
create policy "employee_benefits_write" on public.employee_benefits for all to authenticated
  using (public.can_access('colaboradores'::text, 'edit'::text))
  with check (public.can_access('colaboradores'::text, 'edit'::text));

create policy "employee_epis_read" on public.employee_epis for select to authenticated
  using (public.can_access('colaboradores'::text, 'view'::text));
create policy "employee_epis_write" on public.employee_epis for all to authenticated
  using (public.can_access('colaboradores'::text, 'edit'::text))
  with check (public.can_access('colaboradores'::text, 'edit'::text));

create policy "vacations_read" on public.vacations for select to authenticated
  using (public.can_access('colaboradores'::text, 'view'::text));
create policy "vacations_write" on public.vacations for all to authenticated
  using (public.can_access('colaboradores'::text, 'edit'::text))
  with check (public.can_access('colaboradores'::text, 'edit'::text));

create policy "occupational_exams_read" on public.occupational_exams for select to authenticated
  using (public.can_access('colaboradores'::text, 'view'::text));
create policy "occupational_exams_write" on public.occupational_exams for all to authenticated
  using (public.can_access('colaboradores'::text, 'edit'::text))
  with check (public.can_access('colaboradores'::text, 'edit'::text));

create policy "rgs_processes_read" on public.rgs_processes for select to authenticated
  using (public.can_access('rgs'::text, 'view'::text) or public.can_access('mp'::text, 'view'::text));
create policy "rgs_processes_write" on public.rgs_processes for all to authenticated
  using (public.can_access('rgs'::text, 'edit'::text) or public.can_access('mp'::text, 'edit'::text))
  with check (public.can_access('rgs'::text, 'edit'::text) or public.can_access('rgs'::text, 'create'::text) or public.can_access('mp'::text, 'edit'::text));

notify pgrst, 'reload schema';
