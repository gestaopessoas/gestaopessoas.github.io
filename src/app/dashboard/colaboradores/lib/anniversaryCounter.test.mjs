import assert from "node:assert/strict";
import test from "node:test";
import { countWorkAnniversaries, listWorkAnniversaries } from "./anniversaryCounter.ts";

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

test("sem company_anniversary usa admission_date como fallback", () => {
  const currentYear = new Date().getFullYear();
  const employees = [
    { status: "Ativo", admission_date: `${currentYear - 3}-08-15` }
  ];
  assert.equal(countWorkAnniversaries(employees, 7), 1);
});

test("lista traz anos e ordena por dia", () => {
  const currentYear = new Date().getFullYear();
  const employees = [
    { id: "b", status: "Ativo", company_anniversary: `${currentYear - 2}-08-20` },
    { id: "a", status: "Ativo", company_anniversary: `${currentYear - 5}-08-03` }
  ];
  const list = listWorkAnniversaries(employees, 7);
  assert.deepEqual(list.map((r) => [r.employee.id, r.info.day, r.info.years]), [["a", 3, 5], ["b", 20, 2]]);
});
