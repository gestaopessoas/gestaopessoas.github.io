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
  [{ status: "Compareceu", result: "Reprovado", destination: "Reprovado" }, "Reprovado"],
  // "Descartado" é o destino legado: linhas antigas não podem mudar de etapa (issue #88).
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

// Issue #75: entrevista marcada para hoje ou depois precisa ser registrada antes de a
// etapa avançar, senão ela continua na Agenda e some da Central.
import { interviewOutcomeComplete, pendingScheduledInterview } from "./interviewProgress.mjs";

const HOJE = "2026-09-15";
const marcada = { status: "Confirmado", interview_date: "2026-09-15", interview_time: "09:00" };

const pendingCases = [
  [marcada, true, "entrevista confirmada para hoje é pendente"],
  [{ ...marcada, interview_date: "2026-09-20" }, true, "entrevista futura é pendente"],
  [{ ...marcada, status: "Aguardando" }, true, "aguardando também é pendente"],
  // Entrevista de ontem que ninguém registrou é o caso pior: a pessoa pode ter
  // comparecido e o encontro sumiu do sistema.
  [{ ...marcada, interview_date: "2026-09-14" }, true, "entrevista vencida também trava"],
  [{ ...marcada, status: "Compareceu" }, false, "entrevista já registrada não trava"],
  [{ ...marcada, status: "Não compareceu" }, false, "ausência já registrada não trava"],
  // Linha antiga sem data (ADR 0010) trava igual: é o registro que ninguém fechou.
  [{ ...marcada, interview_date: "" }, true, "entrevista sem data também trava"],
  [{ ...marcada, interview_date: null }, true, "data nula também trava"],
  [null, false, "candidato sem entrevista não trava"],
  [{ status: "" }, false, "situação vazia não trava"],
];

for (const [input, esperado, motivo] of pendingCases) {
  if (Boolean(pendingScheduledInterview(input, HOJE)) !== esperado) {
    throw new Error(`${motivo}: ${JSON.stringify(input)}`);
  }
}

// `overdue` é só para a tela escolher o tempo do verbo ("tem" x "teve").
if (pendingScheduledInterview(marcada, HOJE).overdue !== false) {
  throw new Error("Entrevista de hoje não está vencida");
}
if (pendingScheduledInterview({ ...marcada, interview_date: "2026-09-14" }, HOJE).overdue !== true) {
  throw new Error("Entrevista de ontem está vencida");
}
// Sem data não é "vencida": não dá para dizer que passou o que nunca foi marcado.
const semData = pendingScheduledInterview({ ...marcada, interview_date: "" }, HOJE);
if (semData.undated !== true || semData.overdue !== false) {
  throw new Error(`Entrevista sem data mal classificada: ${JSON.stringify(semData)}`);
}
if (pendingScheduledInterview(marcada, HOJE).undated !== false) {
  throw new Error("Entrevista com data não é sem data");
}

const outcomeCases = [
  [{ status: "Compareceu", result: "Aprovado" }, true],
  [{ status: "Compareceu", result: "Reprovado" }, true],
  [{ status: "Compareceu", result: "N/C" }, false],
  [{ status: "Compareceu", result: "" }, false],
  [{ status: "Não compareceu", result: "" }, true],
  [{ status: "Desistente", result: "" }, true],
  // Manter a entrevista marcada não é registro: é o buraco que a issue #75 fechou.
  [{ status: "Confirmado", result: "N/C" }, false],
  [{ status: "Aguardando", result: "N/C" }, false],
  [{ status: "", result: "" }, false],
  [undefined, false],
];

for (const [input, esperado] of outcomeCases) {
  if (interviewOutcomeComplete(input) !== esperado) {
    throw new Error(`Registro mal validado: ${JSON.stringify(input)}`);
  }
}

console.log("interviewProgress.test.mjs (issue #75) passed");
