# Baseline — run ra-20260902-sel

Roadmap locked by the user: `docs/specs/2026-09-01-vagas-excluidas-orfas-portal-publico.md`.

## Baseline commands

| Command | Exit | Note |
| --- | --- | --- |
| `npx tsc --noEmit` | 0 | clean |
| `npm run lint` (eslint) | 1 | pre-existing failure, 264+ files, includes vendored `.agents/skills/OpenHands`. Acceptance must not regress it; fixing it is out of scope. |
| `git status --porcelain` | 0 | docs-only dirt, listed in preflight.md |

## Root cause independently verified against the code

The spec's claims were checked directly, not accepted on the document's word:

1. `src/app/dashboard/vagas/page.tsx` `deleteRequest()` — confirmed hard delete:
   `supabase.from("job_requests").delete().eq("id", id)`. Nothing touches `job_openings`.
2. `supabase/migrations/20260819110000_job_openings_trigger_full_sync.sql` — the trigger is
   `AFTER INSERT OR UPDATE OF ...`. Its only closing branch is
   `ELSIF TG_OP = 'UPDATE' AND OLD.status = 'Aprovada' THEN UPDATE job_openings SET status='Fechada'`.
   There is no `DELETE` branch and `DELETE` is not in the trigger event list. Confirmed.
3. `supabase/migrations/00000000000000_baseline_producao.sql` — `job_openings` has FKs only for
   `department_id` and `profile_id`. There is **no** FK on `job_request_id`. Confirmed.
   By contrast `job_applications.job_opening_id` is `REFERENCES job_openings(id) ON DELETE CASCADE`,
   which is why a `CASCADE` on the new FK would destroy applications — the spec's warning holds.
4. RLS `job_openings_public_select` exists and is the public read path. Confirmed.

Conclusion: the defect is real and the spec's recommendation (option 2 trigger + option 4 backfill)
is the smallest correct fix. No correction to the plan required.

## Verification environment — NOT proven

| Requirement | State |
| --- | --- |
| Disposable database for mutating tests | **Unavailable now.** Docker CLI 29.7.2 is installed but the daemon is not running (`npipe:////./pipe/dockerDesktopLinuxEngine` not found), so `supabase start` cannot bring up a local stack. |
| Staging project | **None.** `supabase/.temp/project-ref` = the production project. |
| Backup | Manual, local, operator-run script outside this repo. Not verified by this run. |
| Rollback contract | Definable and cheap: `DROP TRIGGER` + `DROP FUNCTION` for the forward trigger. The one-off backfill (`status` -> `'Fechada'`) is **not** freely reversible without recording the affected ids first. |

Per the external-actions reference this is `BLOCKED`: a migration must be tested forward and back on
disposable synthetic data, and without staging it requires a verified backup and a tested rollback.

Environment variable names required (values never read or printed):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Planned task decomposition (contracts not yet issued)

- `vagas-orfas-task-1-trigger` — new migration: `BEFORE DELETE ON job_requests` closing the linked
  `job_openings` row. Allowlist: `supabase/migrations/<new>.sql` + a test script. No app code.
- `vagas-orfas-task-2-backfill` — one-off migration closing `job_openings` whose `job_request_id`
  no longer resolves, recording the affected ids first so the change is reversible.

Explicitly out of scope, per the spec's own "Não fazer nesta rodada": changing the "Excluir" button
to "Arquivar", blocking deletion of approved requests, and adding the missing FK. Any of those would
be a product decision and an immediate `BLOCKED`.
