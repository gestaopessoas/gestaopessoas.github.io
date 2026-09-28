import { test } from "node:test";
import assert from "node:assert/strict";
import { rangeOptions, findOption } from "./salaryRange.mjs";

const row = (id, modality, seniority, level, salary) => ({ id, role_name: "ANALISTA", modality, seniority, level, salary });
const rows = [
  row("p1", "PJ", "Júnior", "Nível I", 2967.66),
  row("c5", "CLT", "Júnior", "Nível V", 3510.84),
  row("c7", "CLT", "Pleno", "Nível II", 3510.84),
  row("c1", "CLT", "Júnior", "Nível I", 2580.58),
  row("x", "CLT", null, null, 1000),
  { ...row("o", "CLT", "Júnior", "Nível I", 1), role_name: "OUTRO" },
];

test("rangeOptions: só a modalidade da vaga, ordena por salário, empate Júnior antes de Pleno", () => {
  const opts = rangeOptions(rows, "ANALISTA", "CLT");
  assert.deepEqual(opts.map((o) => o.id), ["c1", "c5", "c7"]);
  assert.match(opts[0].label, /^Júnior · Nível I — R\$\s2\.580,58$/);
});

test("rangeOptions: sem linha na modalidade mostra todas e marca a modalidade", () => {
  const opts = rangeOptions(rows, "ANALISTA", "Estágio");
  assert.equal(opts.length, 4);
  assert.match(opts[0].label, /^Júnior · Nível I \(CLT\) — /);
});

test("findOption: casa nível + senioridade sem caixa; senioridade vazia casa null", () => {
  const opts = rangeOptions(rows, "ANALISTA", "CLT");
  assert.equal(findOption(opts, "Nível II", "PLENO")?.id, "c7");
  assert.equal(findOption(opts, "Nível II", "Júnior"), undefined);
  assert.equal(findOption(opts, "", "Júnior"), undefined);
  const semSenioridade = rangeOptions([row("s", "CLT", null, "Nível III", 10)], "ANALISTA", "CLT");
  assert.equal(findOption(semSenioridade, "Nível III", "")?.id, "s");
});
