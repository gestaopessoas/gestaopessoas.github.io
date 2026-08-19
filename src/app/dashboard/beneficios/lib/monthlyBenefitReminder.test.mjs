import assert from "node:assert/strict";
import test from "node:test";
import { checkMonthlyBenefitReminder } from "./monthlyBenefitReminder.ts";

test("dia configurado ainda não chegou -> sem notificação", () => {
  const result = checkMonthlyBenefitReminder(10, 15, true);
  assert.equal(result.shouldNotify, false);
});

test("dia configurado chegou e há pendências -> notificação disparada", () => {
  const result = checkMonthlyBenefitReminder(15, 15, true);
  assert.equal(result.shouldNotify, true);
  
  const resultLate = checkMonthlyBenefitReminder(20, 15, true);
  assert.equal(resultLate.shouldNotify, true);
});

test("dia configurado chegou e não há pendências -> sem notificação", () => {
  const result = checkMonthlyBenefitReminder(15, 15, false);
  assert.equal(result.shouldNotify, false);
});
