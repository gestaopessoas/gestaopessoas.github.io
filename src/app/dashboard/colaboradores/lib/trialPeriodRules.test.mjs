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

test("fim de contrato de estágio e jovem aprendiz avisa em 30, 20 e 10 dias", () => {
  const today = new Date(2026, 8, 25);
  const pessoa = (id, contract_type, contract_end_date, status = "Ativo") => ({ id, contract_type, contract_end_date, status });
  const result = trialRules.openContractEnds?.([
    pessoa("longe", "Estágio", "2026-12-31"),
    pessoa("d30", "Estágio", "2026-10-25"),
    pessoa("d20", "Jovem Aprendiz", "2026-10-15"),
    pessoa("d10", "Estágio", "2026-10-05"),
    pessoa("d21", "Estágio", "2026-10-16"),
    pessoa("vencido", "Estágio", "2026-09-20"),
    pessoa("sem-data", "Jovem Aprendiz", null),
    pessoa("clt", "CLT", "2026-10-01"),
    pessoa("desligado", "Estágio", "2026-10-01", "Desligado"),
  ], today);

  assert.deepEqual(result?.map((r) => [r.id, r.daysRemaining, r.stage, r.isOverdue]), [
    ["sem-data", null, 0, false],
    ["vencido", -5, 10, true],
    ["d10", 10, 10, false],
    ["d20", 20, 20, false],
    ["d21", 21, 30, false],
    ["d30", 30, 30, false],
    ["longe", 97, 0, false],
  ]);
});
