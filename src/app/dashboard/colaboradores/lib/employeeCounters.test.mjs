import assert from "node:assert/strict";
import test from "node:test";
import { computeCounters } from "./employeeCounters.ts";

test("lista vazia -> todos contadores zero", () => {
  const result = computeCounters([], 7);
  assert.equal(result.total, 0);
  assert.equal(result.active, 0);
  assert.equal(result.birthdays, 0);
});

test("lista com itens -> calcula corretamente", () => {
  const employees = [
    { status: "Ativo", birthday: "1990-08-15" },
    { status: "Desligado", birthday: "1985-08-10" }
  ];
  const result = computeCounters(employees, 7); // August = 7
  assert.equal(result.total, 2);
  assert.equal(result.active, 1);
  assert.equal(result.birthdays, 2);
});
