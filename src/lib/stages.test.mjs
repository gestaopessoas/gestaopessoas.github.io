import test from "node:test";
import assert from "node:assert/strict";
import { stagesPresent } from "./stages.ts";

const contagem = (obj) => new Map(Object.entries(obj));

test("devolve as Etapas na ordem do funil, nao na ordem de chegada", () => {
  assert.deepEqual(
    stagesPresent(contagem({ Contratado: 1, Triagem: 3, "Entrevista RH": 2 })),
    ["Triagem", "Entrevista RH", "Contratado"],
  );
});

test("Etapa sem ninguem nao aparece", () => {
  assert.deepEqual(stagesPresent(contagem({ Nova: 2 })), ["Nova"]);
});

test("Etapa desconhecida vai pro fim, nunca some", () => {
  assert.deepEqual(
    stagesPresent(contagem({ "Aprovado na Entrevista": 1, Nova: 1 })),
    ["Nova", "Aprovado na Entrevista"],
  );
});

test("sem candidato, sem Etapa", () => {
  assert.deepEqual(stagesPresent(new Map()), []);
});
