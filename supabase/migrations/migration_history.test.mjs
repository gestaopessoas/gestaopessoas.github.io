import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const migrationsDir = dirname(fileURLToPath(import.meta.url));

const restoredProductionFiles = [
  "20260805191352_create_backup_schema_pre_split.sql",
  "20260805191804_create_desativados_arquivo_morto_views.sql",
  "20260805192408_fix_get_employee_financials_benefit_columns.sql",
  "20260805192454_enable_pg_trgm_for_name_matching.sql",
  "20260805193107_reactivate_existing_and_insert_new_missing_employees.sql",
  "20260805194221_move_legacy_rh_acpo_employees_to_arquivo_morto.sql",
  "20260805195247_move_desligados_com_caixa_ou_antigos_para_arquivo_morto.sql",
  "20260805195343_revert_no_box_employees_back_to_desligado.sql",
  "20260805202913_discount_partners_add_contact_fields.sql",
  "20260805204315_fix_bfi_update_policy.sql",
];

test("contains every production migration version missing from previews", async () => {
  const files = await readdir(migrationsDir);
  for (const filename of restoredProductionFiles) {
    assert.ok(files.includes(filename), `missing production migration ${filename}`);
  }
});

test("represents the production realtime version and preserves both local changes", async () => {
  const reconciledRealtime = await readFile(
    join(migrationsDir, "20260803030000_enable_realtime_notifications.sql"),
    "utf8",
  );
  const executableRealtime = await readFile(
    join(migrationsDir, "20260803040000_enable_realtime_notifications.sql"),
    "utf8",
  );
  const resumes = await readFile(
    join(migrationsDir, "20260805210000_create_resumes_bucket.sql"),
    "utf8",
  );

  assert.match(reconciledRealtime, /authoritative remote version/);
  assert.match(executableRealtime, /ALTER PUBLICATION supabase_realtime ADD TABLE/);
  assert.match(resumes, /INSERT INTO storage\.buckets/);
});

test("does not retain the incorrectly versioned BFI migration", async () => {
  const files = await readdir(migrationsDir);
  assert.ok(!files.includes("20260805040000_fix_bfi_update_policy.sql"));
});
