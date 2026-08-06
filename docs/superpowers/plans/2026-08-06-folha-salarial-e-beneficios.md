# Folha Salarial e Benefícios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir salários por experiência e pós-90 dias para cargos sem nível, alertar a troca salarial e corrigir a gravação de VR e nível do colaborador.

**Architecture:** A tabela salarial terá um modo explícito com/sem nível e dois valores monetários para os cargos sem nível. Regras puras cuidam da conversão monetária, da seleção salarial e do alerta de experiência; as telas reutilizam essas regras antes de persistir no Supabase.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/PostgreSQL, Node test runner.

## Global Constraints

- Valores monetários são exibidos e editados em `XX.XXX,XX` e persistidos como número decimal.
- Registros atuais continuam válidos como cargos com nível.
- O alerta começa sete dias antes do 90º dia e só aparece quando há salário pós-experiência configurado e o salário atual ainda é o de experiência.
- VR só é marcado na interface após o Supabase confirmar a gravação.

---

### Task 1: Regras testáveis de folha e persistência crítica

**Files:**
- Modify: `src/app/dashboard/colaboradores/lib/employeeFormRules.mjs`
- Modify: `src/app/dashboard/colaboradores/lib/employeeFormRules.test.mjs`
- Modify: `src/app/dashboard/colaboradores/page.tsx`

**Interfaces:**
- Produces: `formatCurrencyInput(value)`, `parseCurrencyInput(value)`, `salaryChangeDue(admissionDate, baseSalary, experienceSalary, afterProbationSalary, today)`.
- Produces: `criticalFieldsMatch` including `level`.

- [ ] **Step 1: Write failing tests** for Brazilian currency conversion, the 83rd-day salary alert, and level comparison.
- [ ] **Step 2: Run** `node --test src/app/dashboard/colaboradores/lib/employeeFormRules.test.mjs` and confirm the new assertions fail.
- [ ] **Step 3: Implement** the pure helpers and extend the critical-field comparison; use the conversion in the collaborator form salary field and its persistence verification.
- [ ] **Step 4: Run** the same Node test command and confirm all assertions pass.
- [ ] **Step 5: Commit** the focused changes with `fix(colaboradores): valida nivel e salario`.

### Task 2: Salários sem nível e alerta operacional

**Files:**
- Modify: `src/app/dashboard/configuracoes/tabela-salarial/page.tsx`
- Modify: `src/app/dashboard/mps/page.tsx`
- Modify: `src/app/dashboard/colaboradores/page.tsx`
- Create: `supabase/migrations/<generated>_salary_table_trial_salaries.sql`

**Interfaces:**
- Consumes: `uses_level`, `salary_experience`, `salary_after_probation` from `salary_table`.
- Produces: rows that either require a level and one salary, or omit level and provide experience/post-experience salaries.

- [ ] **Step 1: Create a migration** with Supabase CLI that adds the three nullable/backwards-compatible salary columns and a check constraint for non-negative values.
- [ ] **Step 2: Update salary-table loading and editor** so the user selects “Com nível” or “Sem nível”; require the matching fields and format all values as Brazilian currency.
- [ ] **Step 3: Update collaborator and MPS selection** to offer level only for `uses_level`, select the right salary by admission period, and make the 7-day transition alert visible in the collaborator experience view.
- [ ] **Step 4: Run** `npm.cmd exec tsc -- --noEmit` and `npm.cmd run build`.
- [ ] **Step 5: Commit** with `feat(folha): suporta salarios por experiencia`.

### Task 3: Correção da gravação de VR

**Files:**
- Modify: `src/app/dashboard/colaboradores/components/RelatedRecords.tsx`
- Create: `supabase/migrations/<generated>_employee_benefits_edit_policy.sql`

**Interfaces:**
- Produces: `add` returning success/failure and a user-visible error message.
- Database policy permits users with either collaborator create or edit access to insert `employee_benefits`.

- [ ] **Step 1: Add a failing testable helper or regression assertion** showing an insertion failure does not report success.
- [ ] **Step 2: Implement** error propagation in `add`; only reload/update after success and display a clear failure message otherwise.
- [ ] **Step 3: Create a Supabase CLI migration** that replaces the employee-benefits INSERT policy with create-or-edit authorization.
- [ ] **Step 4: Run** the focused tests, TypeScript check, and `git diff --check`.
- [ ] **Step 5: Commit** with `fix(beneficios): informa falha ao salvar vr`.

### Task 4: Apply, verify, and publish

**Files:**
- Verify: all changed files and migrations.

- [ ] **Step 1: Run** `supabase db push` against the linked project and confirm both migrations apply.
- [ ] **Step 2: Run** `node --test src/app/dashboard/colaboradores/**/*.test.mjs`, `npm.cmd exec tsc -- --noEmit`, and `npm.cmd run build`.
- [ ] **Step 3: Inspect** `git status --short` and `git diff --check`; only stage task files.
- [ ] **Step 4: Push** `main` and trigger/monitor the GitHub Pages deploy workflow through a completed successful run.
