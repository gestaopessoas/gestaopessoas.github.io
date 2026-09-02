# Task 2 frontier gate + acceptance — ra-20260831-afin (2026-08-31)

## Gate sequence (arbiter-only, user-authorized)
1. Read final migration (147 lines) — verified additive, idempotent, disjoint benefit buckets, no DO-block, SECURITY INVOKER + pinned search_path, rollback = single DROP FUNCTION.
2. `supabase db push --dry-run` (read-only): would push only `20260825_create_global_analytics_rpc.sql`.
3. `supabase db push`: applied to production (linked project). Warning "failed to cache migrations catalog" is local Docker-only catalog caching, not the apply.
4. Health check / acceptance: `node test-global-analytics-rpc.mjs` — authenticated via signInWithPassword; result: `Success, rows: 354`; asserts row count > 0 and column shape (employee_id, name, base_salary, benefit_vr, benefit_va) — PASS.
5. `npx tsc --noEmit` — 0 errors. `eslint test-global-analytics-rpc.mjs` — 0 errors.

## Correction history
- Cycle 1 (reviewer FAIL): (a) test switched anon -> authenticated; (b) benefit_va '%VA%' overlap removed, buckets aligned with baseline get_employee_financials; (c) ineffective DO-block policy removed; (d) uniform_cost=0 documented; (e) test assertions strengthened.
- Retest (clean context): PASS — all fixes verified against baseline; pre-apply negative test failed for exactly the right reason (function not found).

## Outcome
- ACCEPTED. Commit fc6daa3e6399a024f6b4b1e320ecf55cf834f1b0 ("feat(db): add get_global_analytics_data RPC") — migration + plan checkboxes. test-global-analytics-rpc.mjs stays local (gitignored `test-*.mjs` repo convention).
- Rollback contract: `DROP FUNCTION IF EXISTS public.get_global_analytics_data(integer, integer);`

## Known limitations (documented in migration)
- uniform_cost is 0 (schema has no unit price); uniform_count carries the real datum.
- employee_benefits has no month columns -> active benefits counted as recurring (same as baseline financeiro RPC).
- Absence heuristic: time_logs day with all four punch columns NULL.
- termination_estimate = base_salary + encargos proxy.
