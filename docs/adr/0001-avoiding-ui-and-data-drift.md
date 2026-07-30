# ADR 0001: Avoiding Common UI and Data Drift Bugs

## Status
Accepted

## Context
During the system audit (2026-07-30), several medium and low-risk bugs were identified. These bugs share a common root cause: the decoupling of UI validations, assumptions, and formats from the actual database state and logic. This led to silent failures, inaccurate metrics, and poor user experience.

Key examples observed:
1. **Schema Drift (Required constraints):** `profile_code` is `UNIQUE NOT NULL` in the Postgres database but was left optional in the frontend UI. Submissions silently failed or threw unhandled database errors.
2. **Enum Mismatch:** The UI queried `.eq("status", "ACTIVE")` while the database actually stored `"Ativo"`, leading to empty states on screens (e.g., Férias).
3. **Timezone Offset Bugs:** The frontend parsed ISO strings using `new Date('YYYY-MM-DD')`. In UTC-3, this caused a negative timezone shift, making January 1st become December 31st, breaking vacation and admission calculations.
4. **Falsy Check Hazards:** A `workplace_name` of `null` evaluated to falsy in a `if (!currentWorkplace)` check, accidentally acting as a bypass for a critical UI lock.
5. **Hardcoded Testing Configurations:** Cron functions were pointing to `host.docker.internal` (Supabase local) in production code.

## Decision

To prevent these classes of bugs in the future, we establish the following development guidelines:

### 1. Unified Types and Enums
- Enums **must** be driven by the database schema. If a value is "Ativo" in Postgres, it must be "Ativo" in TypeScript. Avoid manual string literals in queries. 
- Consider using Supabase CLI to generate types (`supabase gen types typescript`) and strictly type `.eq()` queries.

### 2. Timezone-Safe Date Parsing
- **Never** use `new Date('YYYY-MM-DD')` directly to parse date-only strings coming from the database.
- **Always** use a dedicated date library parsing function (e.g., `date-fns`'s `parseISO`) or properly append the time/timezone part to avoid offset shifts.

### 3. Truthiness and Falsy Checks
- Be explicit with boolean evaluations in React when dealing with nullable database fields. 
- Avoid `if (!value)` if `value` being an empty string `""` or `0` means something different than `null`. Use `if (value === null || value === undefined)`.

### 4. Form Validation Parity
- Every column marked `NOT NULL` in the database **must** have a corresponding `required` validation in the frontend form (using native HTML `required`, Zod schemas, or react-hook-form rules).

### 5. Environment Variables over Hardcoding
- Never hardcode URLs. Always use `process.env.NEXT_PUBLIC_SUPABASE_URL` in the frontend and `Deno.env.get("SUPABASE_URL")` in edge functions.

## Consequences
- Slightly more verbose frontend validations and explicit null checks.
- Zero silent database rejections for required fields.
- Reliable date math unaffected by the client's physical timezone.
