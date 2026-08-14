import { normalizeInterviewProgress } from "./interviewProgress.mjs";

const cases = [
  [{ status: "Aguardando", result: "Aprovado" }, { status: "Compareceu", result: "Aprovado" }],
  [{ status: "Compareceu", result: "Banco de Talentos" }, { status: "Compareceu", result: "Banco de Talentos" }],
  [{ status: "Confirmado", result: "N/C" }, { status: "Confirmado", result: "N/C" }],
  [{ status: "Compareceu", result: "Desistente" }, { status: "Desistente", result: "Desistente" }],
];

for (const [input, expected] of cases) {
  const actual = normalizeInterviewProgress(input);
  if (actual.status !== expected.status || actual.result !== expected.result) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log("interviewProgress.test.mjs passed");
