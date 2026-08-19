import assert from "node:assert/strict";
import test from "node:test";
import { prepareMonthlyBenefitUpsert } from "./monthlyBenefitRules.ts";

test("prepara upsert com campos obrigatorios", () => {
  const payload = {
    employee_id: "emp-1",
    benefit_name: "Comissão",
    reference_month: "2026-08",
    value: 1500.50
  };

  const result = prepareMonthlyBenefitUpsert(payload);
  assert.equal(result.employee_id, "emp-1");
  assert.equal(result.benefit_name, "Comissão");
  assert.equal(result.reference_month, "2026-08");
  assert.equal(result.value, 1500.50);
  assert.ok(result.updated_at);
});
