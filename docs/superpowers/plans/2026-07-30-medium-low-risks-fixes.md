# Medium and Low Risks Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all medium and low severity bugs identified in the 2026-07-30 audit, ensuring UI data consistency, correcting calculations, and fixing enum/timezone bugs.

**Architecture:** We will apply surgical fixes directly to the affected React components, utility functions, and Supabase edge functions.

**Tech Stack:** React, Next.js, TypeScript, Supabase, date-fns

## Global Constraints

- No new dependencies should be added.
- Existing tests (if any) must be updated to reflect the fixes.
- Follow the `ponytail` mindset: simplest possible fix.

---

### Task 1: Fix Central do Candidato visual lock bug

**Files:**
- Modify: `src/app/dashboard/central-candidato/components/AddInterviewModal.tsx`

**Interfaces:**
- Consumes: `workplace_name` string or null.
- Produces: Correct evaluation of `currentWorkplace`.

- [ ] **Step 1: Write the failing test / Verify behavior**
Manually verify that a candidate with no workplace (`workplace_name = null`) causes the lock visual to become a no-op (falsy check bypass).

- [ ] **Step 2: Write minimal implementation**
Find the falsy check (e.g., `if (!currentWorkplace)`) and change it to strictly check for undefined/null if an empty string or null is a valid state that should still be locked, or handle the `null` assignment properly.
```tsx
// Example change
const currentWorkplace = candidate.workplace_name ?? "";
// Update the lock condition to properly evaluate if the user is changing to a different valid workplace
const isTryingToChangeWorkplaceWhileLocked = currentWorkplace !== "" && currentWorkplace !== selectedWorkplace;
```

- [ ] **Step 3: Commit**
```bash
git add src/app/dashboard/central-candidato/components/AddInterviewModal.tsx
git commit -m "fix: enforce workplace lock correctly when candidate has no workplace"
```

---

### Task 2: Fix Férias enum "ACTIVE" to "Ativo"

**Files:**
- Modify: `src/app/dashboard/ferias/page.tsx`

**Interfaces:**
- Consumes: Status string.

- [ ] **Step 1: Update the query**
Find `.eq("status", "ACTIVE")` and replace it with `.eq("status", "Ativo")` to match the database enum format.
```tsx
// Change this:
const { data } = await supabase.from('employees').select('*').eq("status", "ACTIVE");

// To this:
const { data } = await supabase.from('employees').select('*').eq("status", "Ativo");
```

- [ ] **Step 2: Commit**
```bash
git add src/app/dashboard/ferias/page.tsx
git commit -m "fix: query employees using correct status Ativo"
```

---

### Task 3: Fix Timezone offset parsing in Férias

**Files:**
- Modify: `src/utils/ferias.ts` or where date parsing happens for vacations.

- [ ] **Step 1: Use parseISO**
Find `new Date('YYYY-MM-DD')` and replace it with `parseISO` to prevent UTC-3 negative offset from shifting the day backwards.
```typescript
import { parseISO } from 'date-fns';

// Change:
// const admission = new Date(employee.admission_date);

// To:
const admission = parseISO(employee.admission_date);
```

- [ ] **Step 2: Commit**
```bash
git add src/utils/ferias.ts
git commit -m "fix: parse dates correctly to avoid UTC timezone offsets"
```

---

### Task 4: Fix Division by Zero in Metas

**Files:**
- Modify: `src/app/dashboard/metas/components/GoalCard.tsx` (or similar target file)

- [ ] **Step 1: Add guard for target = 0**
```tsx
// Change:
// const percentage = (goal.current / goal.target) * 100;

// To:
const percentage = goal.target > 0 ? (goal.current / goal.target) * 100 : 0;
```

- [ ] **Step 2: Commit**
```bash
git add src/app/dashboard/metas/
git commit -m "fix: prevent division by zero in goals percentage calculation"
```

---

### Task 5: Add Required Validation for Job Profile Code

**Files:**
- Modify: `src/app/dashboard/estrutura/components/JobProfileForm.tsx` (or similar)

- [ ] **Step 1: Add HTML/React required validation**
Ensure the input for `profile_code` has the `required` attribute and zod schema (if applicable) is updated.
```tsx
<input 
  type="text" 
  name="profile_code" 
  required 
  // ...
/>
```

- [ ] **Step 2: Commit**
```bash
git add src/app/dashboard/estrutura/
git commit -m "fix: make profile code required on UI to match DB constraint"
```

---

### Task 6: Remove Local Docker URL from Notifications Cron

**Files:**
- Modify: `supabase/functions/notifications/index.ts` (or specific cron function)

- [ ] **Step 1: Use Environment Variable**
```typescript
// Change:
// const url = "http://host.docker.internal:54321/functions/v1/notify";

// To:
const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/notify`;
```

- [ ] **Step 2: Commit**
```bash
git add supabase/functions/
git commit -m "fix: point cron job to correct Supabase URL instead of local docker"
```
