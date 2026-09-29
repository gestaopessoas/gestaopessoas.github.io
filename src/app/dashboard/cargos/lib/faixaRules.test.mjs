import assert from "node:assert/strict";
import test from "node:test";
import { validarFaixas } from "./faixaRules.mjs";

const nivel = (extra = {}) => ({ modality: "CLT", uses_level: true, level: "Nível I", seniority: "", salary: 2000, ...extra });

test("faixa correta passa", () => {
  assert.equal(validarFaixas([nivel(), nivel({ modality: "PJ" }), nivel({ level: "Nível II" })]), "");
});

test("mesma combinação duas vezes reprova, mesmo com caixa diferente na senioridade", () => {
  assert.match(validarFaixas([nivel({ seniority: "Júnior" }), nivel({ seniority: "júnior" })]), /duas vezes/);
});

test("linha removida não conta como duplicata nem como erro", () => {
  assert.equal(validarFaixas([nivel(), nivel({ removida: true, salary: 0 })]), "");
});

test("salário zerado e faixa sem nível incompleta reprovam", () => {
  assert.match(validarFaixas([nivel({ salary: 0 })]), /salário/);
  assert.match(
    validarFaixas([{ modality: "CLT", uses_level: false, salary_experience: 1500, salary_after_probation: null }]),
    /dois salários/,
  );
});
