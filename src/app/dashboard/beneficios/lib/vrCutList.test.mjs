import assert from "node:assert/strict";
import test from "node:test";

import { buildVrCutList } from "./vrCutList.ts";

test("desligado com 1 benefício ativo aparece 1x com o valor daquele benefício", () => {
  const employees = [{ id: "1", name: "Ana", status: "Desligado" }];
  const benefits = [{ employee_id: "1", benefit_type: "VR", value: 500 }];

  const result = buildVrCutList(employees, benefits);
  assert.equal(result.length, 1);
  assert.equal(result[0].totalValue, 500);
  assert.deepEqual(result[0].benefitTypes, ["VR"]);
});

test("desligado com 2 benefícios ativos aparece 1x com valor somado e tipos sem duplicar", () => {
  const employees = [{ id: "1", name: "Ana", status: "Desligado" }];
  const benefits = [
    { employee_id: "1", benefit_type: "VR", value: 500 },
    { employee_id: "1", benefit_type: "VR", value: 300 },
  ];

  const result = buildVrCutList(employees, benefits);
  assert.equal(result.length, 1);
  assert.equal(result[0].totalValue, 800); // soma dos dois registros reais
  assert.deepEqual(result[0].benefitTypes, ["VR"]); // tipo não duplicado na label
});

test("desligado fora da Sede com benefício aparece 1x normalmente", () => {
  const employees = [{ id: "1", name: "Ana", status: "Desligado", workplaceType: "OBRA" }];
  const benefits = [{ employee_id: "1", benefit_type: "VR", value: 500 }];

  const result = buildVrCutList(employees, benefits);
  assert.equal(result.length, 1);
  assert.equal(result[0].employee.workplaceType, "OBRA");
});

test("desligado duplicado no array employees (fan-out) aparece 1x só", () => {
  const employees = [
    { id: "1", name: "Ana", status: "Desligado" },
    { id: "1", name: "Ana", status: "Desligado" },
  ];
  const benefits = [{ employee_id: "1", benefit_type: "VR", value: 500 }];

  const result = buildVrCutList(employees, benefits);
  assert.equal(result.length, 1); // caso central do bug
  assert.equal(result[0].totalValue, 500);
});

test("colaborador ativo nunca aparece, mesmo com benefícios", () => {
  const employees = [{ id: "1", name: "Ana", status: "Ativo" }];
  const benefits = [{ employee_id: "1", benefit_type: "VR", value: 500 }];

  const result = buildVrCutList(employees, benefits);
  assert.equal(result.length, 0);
});

test("desligado sem nenhum benefício não aparece", () => {
  const employees = [{ id: "1", name: "Ana", status: "Desligado" }];
  const benefits = [];

  const result = buildVrCutList(employees, benefits);
  assert.equal(result.length, 0);
});
