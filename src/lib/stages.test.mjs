import test from "node:test";
import assert from "node:assert/strict";
import { jobStages, OBLIGATORY_STAGES, STAGES, stagesPresent } from "./stages.ts";

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

test("vaga sem configuracao usa as 13", () => {
  assert.deepEqual(jobStages(null), [...STAGES]);
  assert.deepEqual(jobStages([]), [...STAGES]);
});

test("devolve o subconjunto na ordem canonica, nao na ordem escolhida", () => {
  assert.deepEqual(
    jobStages(["Em Obra", "Triagem", "Nova", "Contratado", "Reprovado", "Desistente"]),
    ["Nova", "Triagem", "Em Obra", "Contratado", "Reprovado", "Desistente"],
  );
});

test("as Obrigatorias entram mesmo se a vaga nao pedir", () => {
  const funil = jobStages(["Triagem"]);
  for (const etapa of OBLIGATORY_STAGES) assert.ok(funil.includes(etapa), `faltou ${etapa}`);
});

test("valor que nao e Etapa nao entra no funil", () => {
  assert.deepEqual(jobStages(["Teste Tecnico", "Triagem"]).includes("Teste Tecnico"), false);
});
