import test from "node:test";
import assert from "node:assert/strict";
import { diagnosticarCargo, summarizeSalaryRoles } from "./salaryTableViewRules.mjs";

const faixa = (extra) => ({
  role_name: "PEDREIRO",
  modality: "CLT",
  level: "Nível I",
  seniority: null,
  salary: 1000,
  uses_level: true,
  salary_experience: null,
  salary_after_probation: null,
  ...extra,
});

test("faixa vai do menor ao maior valor do cargo", () => {
  const d = diagnosticarCargo([
    faixa({ salary: 1000 }),
    faixa({ level: "Nível II", salary: 2500 }),
    faixa({ level: "Nível III", salary: 1800 }),
  ]);
  assert.deepEqual(d.faixa, { min: 1000, max: 2500 });
  assert.equal(d.linhas, 3);
});

test("cargo sem nível usa experiência e pós-90 na faixa", () => {
  const d = diagnosticarCargo([
    faixa({ uses_level: false, level: null, salary: null, salary_experience: 1500, salary_after_probation: 1900 }),
  ]);
  assert.deepEqual(d.faixa, { min: 1500, max: 1900 });
});

test("mesma combinação com salários diferentes é CONFLITO", () => {
  // O caso real do MESTRE DE OBRAS: Nível I / Júnior com dois valores. O preenchimento
  // automático escolhe um dos dois sem critério.
  const d = diagnosticarCargo([
    faixa({ seniority: "Júnior", salary: 2580.58 }),
    faixa({ seniority: "Júnior", salary: 3421.05 }),
  ]);
  assert.equal(d.conflitos, 1);
  assert.equal(d.duplicadas, 0);
});

test("mesma combinação com o MESMO salário é duplicada, não conflito", () => {
  const d = diagnosticarCargo([faixa({ salary: 1000 }), faixa({ salary: 1000 })]);
  assert.equal(d.conflitos, 0);
  assert.equal(d.duplicadas, 1);
});

test("regime diferente não é duplicata", () => {
  const d = diagnosticarCargo([faixa({ modality: "CLT" }), faixa({ modality: "PJ", salary: 1200 })]);
  assert.equal(d.conflitos, 0);
  assert.equal(d.duplicadas, 0);
});

test("cargo sem nenhum valor não inventa faixa", () => {
  const d = diagnosticarCargo([faixa({ salary: null })]);
  assert.equal(d.faixa, null);
});

test("o resumo por cargo carrega o diagnóstico junto", () => {
  const resumo = summarizeSalaryRoles([
    faixa({ salary: 1000 }),
    faixa({ seniority: "Júnior", salary: 2000 }),
    faixa({ seniority: "Júnior", salary: 3000 }),
  ]);
  assert.equal(resumo.length, 1);
  assert.equal(resumo[0].conflitos, 1);
  assert.deepEqual(resumo[0].faixa, { min: 1000, max: 3000 });
});
