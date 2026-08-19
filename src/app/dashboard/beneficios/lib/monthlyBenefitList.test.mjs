import assert from "node:assert/strict";
import test from "node:test";

export const mergeMonthlyBenefits = (activeBenefits, monthlyEntries, currentMonth) => {
  return activeBenefits.map(ab => {
    const entry = monthlyEntries.find(m => m.employee_id === ab.employee_id && m.benefit_name === ab.benefit_name && m.reference_month === currentMonth);
    return {
      employee_id: ab.employee_id,
      benefit_name: ab.benefit_name,
      value: entry?.value || 0,
      is_filled: !!entry
    };
  });
};

test("colaborador sem esses beneficios -> nao aparece na aba (filtrado antes da merge)", () => {
  const activeBenefits = [];
  const monthlyEntries = [];
  const result = mergeMonthlyBenefits(activeBenefits, monthlyEntries, "2026-08");
  assert.equal(result.length, 0);
});

test("colaborador com benefício e mês preenchido -> mostra valor, editável", () => {
  const activeBenefits = [
    { employee_id: "emp-1", benefit_name: "Comissão" }
  ];
  const monthlyEntries = [
    { employee_id: "emp-1", benefit_name: "Comissão", reference_month: "2026-08", value: 500 }
  ];
  const result = mergeMonthlyBenefits(activeBenefits, monthlyEntries, "2026-08");
  assert.equal(result.length, 1);
  assert.equal(result[0].is_filled, true);
  assert.equal(result[0].value, 500);
});

test("colaborador com benefício e mês não preenchido -> pendente", () => {
  const activeBenefits = [
    { employee_id: "emp-1", benefit_name: "Comissão" }
  ];
  const monthlyEntries = []; // vazio
  const result = mergeMonthlyBenefits(activeBenefits, monthlyEntries, "2026-08");
  assert.equal(result.length, 1);
  assert.equal(result[0].is_filled, false);
  assert.equal(result[0].value, 0);
});
