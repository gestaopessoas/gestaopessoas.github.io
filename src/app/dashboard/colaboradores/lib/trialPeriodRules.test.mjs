import assert from "node:assert/strict";
import test from "node:test";

let trialRules = {};
try {
  trialRules = await import("./trialPeriodRules.mjs");
} catch {
  // O teste deve falhar enquanto a regra ainda não existir.
}

test("mantém a experiência vencida até ser concluída manualmente", () => {
  const result = trialRules.openTrialPeriods?.(
    [
      { id: "vencida", name: "Ana", admission_date: "2026-01-01", status: "Ativo" },
      { id: "concluida", name: "Bia", admission_date: "2026-01-01", status: "Ativo" },
      { id: "nao-clt", name: "Caio", admission_date: "2026-01-01", status: "Ativo", contract_type: "PJ" },
    ],
    new Set(["concluida"]),
    new Date("2026-05-01T12:00:00")
  );

  assert.deepEqual(result, [{
    id: "vencida",
    name: "Ana",
    daysRemaining: -30,
    endDate: "2026-04-01",
    isWarning: true,
    isOverdue: true,
  }]);
});

test("calcula a data final exata de 90 dias", () => {
  assert.equal(trialRules.trialEndDate?.("2026-01-31"), "2026-05-01");
});
