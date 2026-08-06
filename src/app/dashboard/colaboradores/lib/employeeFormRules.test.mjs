import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizeOption,
  criticalFieldsMatch,
  getScheduleForWorkplaceType,
  sanitizeRgInput,
} from "./employeeFormRules.mjs";

test("converte opção legada para o valor canônico sem diferenciar caixa", () => {
  const options = ["Ativo", "Férias", "Afastado", "Inativo", "Desligado"];
  assert.equal(canonicalizeOption("ativo", options), "Ativo");
  assert.equal(canonicalizeOption("FÉRIAS", options), "Férias");
});

test("converte status legado inactive para Inativo", () => {
  const options = ["Ativo", "Férias", "Afastado", "Inativo", "Desligado"];
  assert.equal(canonicalizeOption("inactive", options), "Inativo");
});

test("mantém valor desconhecido para não apagar dados legados", () => {
  assert.equal(canonicalizeOption("Licença", ["Ativo"]), "Licença");
});

test("sugere jornada de obra", () => {
  assert.deepEqual(getScheduleForWorkplaceType("obra"), {
    work_schedule_start_1: "07:30",
    work_schedule_end_1: "12:00",
    work_schedule_start_2: "13:15",
    work_schedule_end_2: "17:33",
    weekly_hours: "44",
    work_days: "Segunda a Sexta",
  });
});

test("sede e plantão usam a mesma jornada", () => {
  const sede = getScheduleForWorkplaceType("SEDE");
  assert.deepEqual(getScheduleForWorkplaceType("PLANTÃO DE VENDAS"), sede);
  assert.deepEqual(getScheduleForWorkplaceType("plantao"), sede);
  assert.equal(sede?.work_schedule_start_1, "07:45");
  assert.equal(sede?.work_schedule_end_2, "17:48");
  assert.equal(sede?.weekly_hours, "44");
});

test("não sugere jornada para tipo desconhecido", () => {
  assert.equal(getScheduleForWorkplaceType("FILIAL"), null);
});

test("confere os campos críticos devolvidos pelo banco", () => {
  const expected = {
    rg: "001234567890123",
    profile_code: "C-0100",
    company_id: "company-1",
    workplace_id: "workplace-1",
    marital_status: "Casado(a)",
    status: "Ativo",
  };

  assert.equal(criticalFieldsMatch(expected, { ...expected }), true);
  assert.equal(criticalFieldsMatch(expected, { ...expected, profile_code: null }), false);
  assert.equal(criticalFieldsMatch(expected, { ...expected, rg: "1234567890123" }), false);
});

test("RG mantém somente os primeiros 15 dígitos e preserva zeros à esquerda", () => {
  assert.equal(sanitizeRgInput("00.123-ABC 4567890123456"), "001234567890123");
});
