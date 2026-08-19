import assert from "node:assert/strict";
import test from "node:test";
import { calculateFinancialCosts } from "./financialCosts.ts";

test("nenhum colaborador elegível -> custo zero", () => {
  const employees = [
    { id: "1", name: "João", hasSeguroVida: false, hasAlmoco: false, status: "Ativo" }
  ];
  const result = calculateFinancialCosts(employees, 10, 20);
  assert.equal(result.seguroTotal, 0);
  assert.equal(result.almocoTotal, 0);
});

test("colaboradores com e sem o benefício -> soma só os elegíveis", () => {
  const employees = [
    { id: "1", name: "João", hasSeguroVida: true, hasAlmoco: false, status: "Ativo" },
    { id: "2", name: "Maria", hasSeguroVida: true, hasAlmoco: true, status: "Ativo" },
    { id: "3", name: "Pedro", hasSeguroVida: false, hasAlmoco: false, status: "Ativo" }
  ];
  const result = calculateFinancialCosts(employees, 10, 20);
  assert.equal(result.seguroCount, 2);
  assert.equal(result.seguroTotal, 20);
  assert.equal(result.almocoCount, 1);
  assert.equal(result.almocoTotal, 20);
});

test("valor unitário alterado -> total recalcula", () => {
  const employees = [
    { id: "1", name: "João", hasSeguroVida: true, hasAlmoco: true, status: "Ativo" }
  ];
  const result1 = calculateFinancialCosts(employees, 10, 20);
  assert.equal(result1.seguroTotal, 10);
  assert.equal(result1.almocoTotal, 20);

  const result2 = calculateFinancialCosts(employees, 15, 25);
  assert.equal(result2.seguroTotal, 15);
  assert.equal(result2.almocoTotal, 25);
});

test("colaborador desligado no meio do período -> conta custo cheio do mês, sem pró-rata", () => {
  const employees = [
    { id: "1", name: "João", hasSeguroVida: true, hasAlmoco: true, status: "Desligado", dismissed_at: "2026-08-15" }
  ];
  const result = calculateFinancialCosts(employees, 10, 20);
  assert.equal(result.seguroTotal, 10);
  assert.equal(result.almocoTotal, 20);
});
