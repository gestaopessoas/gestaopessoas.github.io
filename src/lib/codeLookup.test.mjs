import assert from "node:assert/strict";
import test from "node:test";
import { findCode } from "./codeLookup.ts";

const mockCargos = [
  { title: "Engenheiro Civil", profile_code: "ENG-01" },
  { title: "Pedreiro de Acabamento", profile_code: "PED-02" },
  { title: "Pedreiro", profile_code: "PED-01" }
];

const mockCbo = [
  { title: "Engenheiro Civil", code: "214205" },
  { title: "Pedreiro", code: "715210" },
  { title: "Pedreiro de acabamento", code: "715230" },
  { title: "Servente", code: "717020" }
];

test("nome exato -> retorna código certo", () => {
  const result = findCode("Engenheiro Civil", "cargo", mockCargos);
  assert.equal(result.code, "ENG-01");
  assert.equal(result.matches.length, 1);
});

test("nome com acento/caixa diferente -> ainda encontra", () => {
  const result = findCode("engenhéiro civíl", "cbo", mockCbo);
  assert.equal(result.code, "214205");
});

test("nome parcial -> retorna lista de candidatos se houver múltiplos", () => {
  const result = findCode("pedreiro", "cbo", mockCbo);
  // 'pedreiro' is an EXACT MATCH to 'Pedreiro' so it should return exact immediately
  assert.equal(result.code, "715210");
  assert.equal(result.matches.length, 1);

  const resultPartial = findCode("pedreir", "cbo", mockCbo);
  // 'pedreir' is partial, matches 'Pedreiro' and 'Pedreiro de acabamento'
  assert.equal(resultPartial.code, null, "Não deve retornar código único se houver múltiplos parciais");
  assert.equal(resultPartial.matches.length, 2);
  assert.equal(resultPartial.matches[0].code, "715210"); // Pedreiro é mais curto, score menor
});

test("nome sem nenhum match -> mensagem clara, não quebra", () => {
  const result = findCode("astronauta", "cargo", mockCargos);
  assert.equal(result.code, null);
  assert.equal(result.matches.length, 0);
});

test("mesma função reaproveitada para cargo e para CBO", () => {
  const rCargo = findCode("servente", "cargo", mockCargos);
  assert.equal(rCargo.code, null);
  
  const rCbo = findCode("servente", "cbo", mockCbo);
  assert.equal(rCbo.code, "717020");
});
