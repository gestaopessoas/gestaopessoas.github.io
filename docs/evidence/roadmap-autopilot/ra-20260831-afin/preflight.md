# Preflight evidence — run ra-20260831-afin (2026-08-31)

## Repository identity
- Repo: gestaopessoas.github.io, branch `main`, clean working tree
- Base SHA: `8cf7b2727d32efc394cab7aaf0b89d971d4e3258`
- Git identity configured (Bruno Souza), remotes: `origin` (gestaopessoas/gestaopessoas.github.io), `pessoal`
- GitHub auth: account psibrunosg, scope `repo` (push possible; run policy: commit only, no push unless requested)

## Roadmap
- Selected: docs/superpowers/plans/2026-08-25-analytics-financeiro-plan.md
- Spec: docs/superpowers/specs/2026-08-25-analytics-financeiro-design.md
- Task 1 (rename analytics -> metricas-recrutamento) already committed pre-run at `1ec71a3`
- Pending: Task 2 (RPC get_global_analytics_data), Task 3 (Financeiro refactor), Task 4 (global Analytics dashboard)

## Tooling
- node v24.16.0, npm 11.13.0, Playwright 1.62.1, Supabase CLI 2.110.0
- Docker: NOT available -> no disposable local Supabase DB, no staging

## Environment (names only, no values)
- `.env` (gitignored): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, LOGIN_BRUNO, PASS_BRUNO
- `.env.local`: absent. `.env.local.txt`: NEXT_PUBLIC_GEMINI_API_KEY, LOGIN_BRUNO, PASS_BRUNO (no Supabase vars -> plan's Task 2 test script must load `.env`, not `.env.local.txt`)
- Supabase linked project ref: bnwwdseczwrmmuvallml (production)

## Baseline at base SHA
- `npx tsc --noEmit`: PASS (0 errors)
- `eslint src e2e`: FAIL pre-existing — 92 errors / 145 warnings (no-explicit-any, setState-in-effect, etc.)
- `npm run lint` (full repo): FAIL pre-existing — 320 errors / 419 warnings, includes binary `types.ts` parse error and `.agents/` skill files
- Acceptance gate definition: tsc must remain clean; eslint error count in allowed paths must not increase; task-specific Playwright specs must pass

## Active external gates
- GATE-PROD-DB: Task 2 migration must be applied to linked production project. Additive `CREATE OR REPLACE FUNCTION`; rollback = `DROP FUNCTION get_global_analytics_data(...)`. Requires explicit user authorization + `db push --dry-run` before apply.

## Constraints for implementers
- Next.js 16.2.10 has breaking changes: read `node_modules/next/dist/docs/` guides before writing code (AGENTS.md rule)
- RPC columns must match `supabase/migrations/00000000000000_baseline_producao.sql` (legacy migrations do not run)
- RPC must be RLS-safe (prefer invoker rights + explicit search_path; check existing analytics RLS patterns in baseline)
- Workers must not run `supabase db push`, commit, or push
