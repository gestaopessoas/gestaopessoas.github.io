import assert from "node:assert/strict";
import test from "node:test";
import { countWorkAnniversaries } from "./anniversaryCounter.ts";

test("colaborador admitido há 1 ano no mês de referência -> conta", () => {
  const currentYear = new Date().getFullYear();
  const employees = [
    { status: "Ativo", company_anniversary: `${currentYear - 1}-08-15` }
  ];
  assert.equal(countWorkAnniversaries(employees, 7), 1);
});

test("colaborador admitido no mesmo mês/dia mas ano corrente (menos de 1 ano) -> não conta", () => {
  const currentYear = new Date().getFullYear();
  const employees = [
    { status: "Ativo", company_anniversary: `${currentYear}-08-15` }
  ];
  assert.equal(countWorkAnniversaries(employees, 7), 0);
});

test("colaborador desligado -> não conta", () => {
  const currentYear = new Date().getFullYear();
  const employees = [
    { status: "Desligado", company_anniversary: `${currentYear - 1}-08-15` }
  ];
  assert.equal(countWorkAnniversaries(employees, 7), 0);
});

test("sem data de aniversário de empresa -> ignorado", () => {
  const employees = [
    { status: "Ativo" }
  ];
  assert.equal(countWorkAnniversaries(employees, 7), 0);
});

test("lista vazia -> zero", () => {
  assert.equal(countWorkAnniversaries([], 7), 0);
});
