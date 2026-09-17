// Run with: node src/lib/salaryLevels.test.mjs
import assert from "node:assert/strict";
import { sortLevels } from "./salaryLevels.mjs";

assert.deepEqual(
  sortLevels(["Nível IV", "Nível II", "Nível III", "Nível V", "Nível I"]),
  ["Nível I", "Nível II", "Nível III", "Nível IV", "Nível V"]
);

// Sem o prefixo, e com caixa/espaço bagunçados
assert.deepEqual(sortLevels([" iv ", "II", "nível i"]), ["nível i", "II", " iv "]);

// Rótulo que não é romano vai para o fim, em ordem estável
assert.deepEqual(sortLevels(["Sênior", "Nível II", "Aprendiz"]), ["Nível II", "Aprendiz", "Sênior"]);

console.log("salaryLevels: ok");
