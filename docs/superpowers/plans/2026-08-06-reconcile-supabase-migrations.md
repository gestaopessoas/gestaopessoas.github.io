# Reconcile Supabase Migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the repository migration history with the production Supabase history so GitHub preview branches can be created again.

**Architecture:** Production migration versions remain authoritative. Missing remote SQL is restored under its original version, while local SQL that reused an already-applied version is moved to a new later migration so both changes execute in a clean database.

**Tech Stack:** Supabase/Postgres migrations, Node.js built-in test runner.

## Global Constraints

- Do not modify production migration history.
- Preserve every existing local schema change.
- Migration filenames must use the exact version recorded by Supabase.

---

### Task 1: Add migration-history regression coverage

**Files:**
- Create: `supabase/migrations/migration_history.test.mjs`

**Interfaces:**
- Consumes: filenames under `supabase/migrations`
- Produces: a Node test that rejects missing production versions and version reuse

- [ ] Add assertions for every production version reported by Supabase on 2026-08-06.
- [ ] Assert that `20260803030000` contains the production Realtime migration.
- [ ] Assert that the resumes bucket SQL is retained under a later version.
- [ ] Run `node --test supabase/migrations/migration_history.test.mjs` and confirm failure.

### Task 2: Restore production history and preserve local SQL

**Files:**
- Create: the ten missing `20260805*.sql` files using SQL read from `supabase_migrations.schema_migrations`
- Modify: `supabase/migrations/20260803030000_create_resumes_bucket.sql`
- Create: `supabase/migrations/20260805210000_create_resumes_bucket.sql`
- Remove: `supabase/migrations/20260805040000_fix_bfi_update_policy.sql`

**Interfaces:**
- Consumes: authoritative `version`, `name`, and `statements` rows from production
- Produces: a one-to-one local representation of remote versions plus a later resumes migration

- [ ] Restore each remote statement without semantic edits.
- [ ] Move the existing resumes bucket SQL to version `20260805210000`.
- [ ] Restore Realtime SQL at version `20260803030000`.
- [ ] Restore `fix_bfi_update_policy` at version `20260805204315` and remove the incorrectly versioned duplicate.

### Task 3: Verify the reconciliation

**Files:**
- Test: `supabase/migrations/migration_history.test.mjs`

**Interfaces:**
- Consumes: reconciled migration directory
- Produces: passing local history check and a clean Supabase Preview input

- [ ] Run the migration-history regression test.
- [ ] Run the repository test suite.
- [ ] Inspect the final diff for accidental production-history edits.
