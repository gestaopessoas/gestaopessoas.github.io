# Global Analytics e Financeiro Dinâmico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar o módulo de Analytics para atuar como painel global (RH+GP) e o Financeiro para tabela analítica dinâmica, eliminando fechamentos (snapshots).

**Architecture:** Mover métricas de recrutamento; criar RPC de cálculo dinâmico (get_global_analytics_data); remodelar interfaces do Analytics e Financeiro.

**Tech Stack:** Next.js, Supabase, Tailwind, Recharts, Playwright.

**Spec:** docs/superpowers/specs/2026-08-25-analytics-financeiro-design.md

## Global Constraints
- Sem congelamento (snapshots) de dados financeiros.
- Todos os custos extraídos dinamicamente do banco.

---

### Task 1: Renomear Analytics para Metricas de Recrutamento

**Files:**
- Modify: `src/app/dashboard/layout.tsx:1-100` (update navigation links)
- Create: `src/app/dashboard/metricas-recrutamento/page.tsx`
- Delete: `src/app/dashboard/analytics/page.tsx`

**Interfaces:**
- Consumes: N/A
- Produces: `/dashboard/metricas-recrutamento` route for old analytics.

- [ ] **Step 1: Write the failing test**

```typescript
// e2e/metricas-recrutamento.spec.ts
import { test, expect } from '@playwright/test';
test('Navega para metricas de recrutamento', async ({ page }) => {
  await page.goto('/dashboard/metricas-recrutamento');
  await expect(page.locator('h1')).toContainText('Analytics & Relatórios');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/metricas-recrutamento.spec.ts`
Expected: FAIL (404)

- [ ] **Step 3: Write minimal implementation**

Move `src/app/dashboard/analytics/page.tsx` to `src/app/dashboard/metricas-recrutamento/page.tsx`. Update the sidebar link in `layout.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/metricas-recrutamento.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/layout.tsx src/app/dashboard/metricas-recrutamento e2e/metricas-recrutamento.spec.ts
git rm -r src/app/dashboard/analytics/page.tsx
git commit -m "refactor: rename analytics to metricas-recrutamento"
```

---

### Task 2: Criar a RPC get_global_analytics_data

**Files:**
- Create: `supabase/migrations/20260825_create_global_analytics_rpc.sql`
- Create: `test-global-analytics-rpc.mjs`

**Interfaces:**
- Consumes: `employees`, `companies`, `cost_centers`, `departments`, `employee_benefits`, `employee_uniforms`, `time_logs`
- Produces: `get_global_analytics_data(p_month integer, p_year integer)`

- [x] **Step 1: Write the failing test**

```javascript
// test-global-analytics-rpc.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local.txt' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.rpc('get_global_analytics_data', { p_month: 8, p_year: 2026 });
  if (error) { console.error(error); process.exit(1); }
  console.log('Success, rows:', data.length);
  process.exit(0);
}
run();
```

- [x] **Step 2: Run test to verify it fails**

Run: `node test-global-analytics-rpc.mjs`
Expected: FAIL

- [x] **Step 3: Write minimal implementation**

Write `supabase/migrations/20260825_create_global_analytics_rpc.sql` returning employee details, salários, encargos, benefícios, uniformes e faltas estimadas. Apply the migration using Supabase CLI.

- [x] **Step 4: Run test to verify it passes**

Run: `node test-global-analytics-rpc.mjs`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add supabase/migrations/ test-global-analytics-rpc.mjs
git commit -m "feat(db): add get_global_analytics_data RPC"
```

---

### Task 3: Refatorar a página Financeiro

**Files:**
- Modify: `src/app/dashboard/financeiro/page.tsx:1-500`
- Modify: `e2e/financeiro.spec.ts`

**Interfaces:**
- Consumes: `get_global_analytics_data`
- Produces: Updated table UI

- [x] **Step 1: Write the failing test**

```typescript
// e2e/financeiro.spec.ts
import { test, expect } from '@playwright/test';
test('Financeiro page renders without snapshot buttons', async ({ page }) => {
  await page.goto('/dashboard/financeiro');
  await expect(page.locator('text=Salvar Fechamento')).toHaveCount(0);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/financeiro.spec.ts`
Expected: FAIL

- [x] **Step 3: Write minimal implementation**

Update `financeiro/page.tsx`. Change RPC call. Remove status, handleSaveSnapshot, handleRevert. Add columns for department, uniforms, absences, termination.

- [x] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/financeiro.spec.ts`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/app/dashboard/financeiro/page.tsx e2e/financeiro.spec.ts
git commit -m "refactor(ui): update financeiro page"
```

---

### Task 4: Criar o novo Dashboard Analytics Global

**Files:**
- Create: `src/app/dashboard/analytics/page.tsx`
- Create: `e2e/global-analytics.spec.ts`

**Interfaces:**
- Consumes: `get_global_analytics_data`
- Produces: New dashboard at `/dashboard/analytics`

- [ ] **Step 1: Write the failing test**

```typescript
// e2e/global-analytics.spec.ts
import { test, expect } from '@playwright/test';
test('Global analytics page renders charts', async ({ page }) => {
  await page.goto('/dashboard/analytics');
  await expect(page.locator('text=Custo Total Folha')).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/global-analytics.spec.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Create `analytics/page.tsx`. Use `get_global_analytics_data`. Implement total summary cards and Recharts graphs.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/global-analytics.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/analytics e2e/global-analytics.spec.ts
git commit -m "feat(ui): add new global analytics dashboard"
```
