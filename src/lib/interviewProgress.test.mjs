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

import { formatInterviewSchedule, interviewHistoryStage, interviewProgressChanged, roleChangedOnSavedInterview } from "./interviewProgress.mjs";

const stageCases = [
  [{ status: "Compareceu", result: "Aprovado", destination: "Contratado" }, "Contratado"],
  [{ status: "Compareceu", result: "Aprovado", destination: "Banco de Talentos" }, "Banco de Talentos"],
  [{ status: "Compareceu", result: "Reprovado", destination: "Descartado" }, "Reprovado"],
  [{ status: "Desistente", result: "N/C", destination: "Desistente" }, "Desistente"],
  [{ status: "Compareceu", result: "Reprovado", destination: "" }, "Reprovado"],
  [{ status: "Aguardando", result: "N/C", destination: "" }, "Entrevista RH"],
];

for (const [input, expected] of stageCases) {
  const actual = interviewHistoryStage(input);
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual} for ${JSON.stringify(input)}`);
}

if (interviewProgressChanged({ status: "Aguardando", result: "N/C", destination: "" }, { status: "Aguardando", result: "N/C", destination: "" })) {
  throw new Error("Situação igual não pode contar como mudança");
}
if (!interviewProgressChanged({ status: "Aguardando", result: "N/C", destination: "" }, { status: "Compareceu", result: "N/C", destination: "" })) {
  throw new Error("Mudança de status precisa gerar histórico");
}

const scheduleCases = [
  [["2026-09-14", "14:30"], "14/09/2026 as 14:30"],
  [["2026-09-14", ""], "14/09/2026"],
  [["", "14:30"], "Horario: 14:30"],
  [["", ""], "Data nao informada"],
];

for (const [[date, time], expected] of scheduleCases) {
  const actual = formatInterviewSchedule(date, time).normalize("NFD").replace(/\p{Diacritic}/gu, "");
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

// Ausência manda no resultado: quem não apareceu não fica "Aprovado".
const ausencia = normalizeInterviewProgress({ status: "Não compareceu", result: "Aprovado", interview_date: "2026-09-12" });
if (ausencia.status !== "Não compareceu" || ausencia.result !== "N/C" || ausencia.interview_date !== "2026-09-12") {
  throw new Error(`Ausência mal normalizada: ${JSON.stringify(ausencia)}`);
}
if (interviewHistoryStage({ status: "Não compareceu", result: "N/C", destination: "" }) !== "Entrevista RH") {
  throw new Error("Faltar não pode virar etapa terminal");
}

// Vaga diferente numa entrevista salva precisa virar pergunta, não sobrescrita silenciosa.
if (!roleChangedOnSavedInterview("id-1", "Pedreiro", "Servente")) throw new Error("Troca de vaga precisa perguntar");
if (roleChangedOnSavedInterview("id-1", "Pedreiro", "Pedreiro")) throw new Error("Mesma vaga não pergunta");
if (roleChangedOnSavedInterview(null, "Pedreiro", "Servente")) throw new Error("Entrevista nova não pergunta");
if (roleChangedOnSavedInterview("id-1", "", "Servente")) throw new Error("Sem vaga anterior não pergunta");
