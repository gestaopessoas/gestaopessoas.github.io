import { normalizeInterviewProgress } from "./interviewProgress.mjs";

const cases = [
  [{ status: "Aguardando", result: "Aprovado" }, { status: "Compareceu", result: "Aprovado", destination: "" }],
  [{ status: "Compareceu", result: "Aprovado", destination: "Banco de Talentos" }, { status: "Compareceu", result: "Aprovado", destination: "Banco de Talentos" }],
  [{ status: "Confirmado", result: "N/C" }, { status: "Confirmado", result: "N/C", destination: "" }],
  [{ status: "Desistente", result: "N/C" }, { status: "Desistente", result: "N/C", destination: "Desistente" }],
];

for (const [input, expected] of cases) {
  const actual = normalizeInterviewProgress(input);
  if (actual.status !== expected.status || actual.result !== expected.result || actual.destination !== expected.destination) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log("interviewProgress.test.mjs passed");
