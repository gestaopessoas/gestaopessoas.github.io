import { buildCandidateHistoryRecord, buildCandidateFromInterviewProfile, getCandidateHistoryTargetId, parseCandidateHistoryNotes, buildCandidateHistoryNotes, canEditCandidateHistory } from "./candidateHistory.mjs";

const record = buildCandidateHistoryRecord({
  candidateId: "candidate-1",
  stage: "Em entrevista",
  reason: "Avanço de Etapa",
  notes: "Boa comunicação técnica.",
  workplaceName: "Obra Moov",
  interviewerName: "Ana Silva",
  candidateFuture: "Avançar no processo",
});

const expected = {
  candidate_id: "candidate-1",
  stage: "Em entrevista",
  rejection_reason: "Avanço de Etapa",
  notes: "[Motivo]\nAvanço de Etapa\n\n[Feedback Interno]\nBoa comunicação técnica.",
  workplace_name: "Obra Moov",
  interviewer_name: "Ana Silva",
  candidate_future: "Avançar no processo",
};

for (const [key, value] of Object.entries(expected)) {
  if (record[key] !== value) {
    throw new Error(`Expected ${key} to be ${JSON.stringify(value)}, got ${JSON.stringify(record[key])}`);
  }
}

console.log("candidateHistory.test.mjs passed");


if (getCandidateHistoryTargetId({ candidateId: "candidate-1", resolvedCandidateId: "candidate-2" }) !== "candidate-1") {
  throw new Error("An explicit candidate ID must be used for the history record");
}
if (getCandidateHistoryTargetId({ candidateId: null, resolvedCandidateId: "candidate-2" }) !== "candidate-2") {
  throw new Error("The resolved candidate ID must be used for interview profiles");
}
if (getCandidateHistoryTargetId({ candidateId: null, resolvedCandidateId: null }) !== null) {
  throw new Error("An unresolved interview must not produce a history candidate ID");
}

const candidateFromInterview = buildCandidateFromInterviewProfile({
  full_name: "Maria da Silva",
  email: "MARIA@EXAMPLE.COM ",
  phone: "11999999999",
  city: "São Paulo",
  role_interest: "Engenheira",
});
if (candidateFromInterview?.first_name !== "Maria" || candidateFromInterview?.last_name !== "da Silva" || candidateFromInterview?.email !== "maria@example.com") {
  throw new Error("The interview profile must create a valid candidate record");
}
if (buildCandidateFromInterviewProfile({ full_name: "Maria da Silva" }) !== null) {
  throw new Error("A candidate record must not be created without the required email");
}

const parsedSections = parseCandidateHistoryNotes(record.notes);
if (parsedSections.length !== 2) {
  throw new Error(`Expected 2 sections, got ${JSON.stringify(parsedSections)}`);
}
if (parsedSections[0].label !== "Motivo" || parsedSections[0].value !== "Avanço de Etapa") {
  throw new Error(`The first section must be the reason, got ${JSON.stringify(parsedSections[0])}`);
}
if (parsedSections[1].label !== "Feedback Interno" || parsedSections[1].value !== "Boa comunicação técnica.") {
  throw new Error(`The second section must be the internal feedback, got ${JSON.stringify(parsedSections[1])}`);
}

const multilineSections = parseCandidateHistoryNotes("[Pontos Fortes]\nLidera bem.\nEntrega no prazo.\n\n[Observações Gerais]\nSem ressalvas.");
if (multilineSections[0].value !== "Lidera bem.\nEntrega no prazo.") {
  throw new Error(`A section must keep its own line breaks, got ${JSON.stringify(multilineSections[0])}`);
}
if (multilineSections.length !== 2) {
  throw new Error(`A blank line must not become a section, got ${JSON.stringify(multilineSections)}`);
}

const legacySections = parseCandidateHistoryNotes("Anotação antiga, sem rótulo nenhum.");
if (legacySections.length !== 1 || legacySections[0].label !== null || legacySections[0].value !== "Anotação antiga, sem rótulo nenhum.") {
  throw new Error(`A legacy free-text note must survive as an unlabeled section, got ${JSON.stringify(legacySections)}`);
}

if (parseCandidateHistoryNotes(null).length !== 0 || parseCandidateHistoryNotes("[Motivo]\n").length !== 0) {
  throw new Error("An empty note must not produce any section");
}

console.log("parseCandidateHistoryNotes passed");

// Issue #142, passo 2: a edicao desmonta as notas em campos e as monta de volta. O que nao
// pode acontecer e a volta perder rotulo, ordem ou quebra de linha - seria apagar o parecer
// de outra pessoa sem avisar.
const RICO = "[Avaliação Técnica]\nDomina a norma.\n\n[Pontos Fortes]\nPontual.\nAceita turnos.\n\n[Observações Gerais]\nComeça depois do dia 10.";
const ida = parseCandidateHistoryNotes(RICO);
const volta = buildCandidateHistoryNotes(ida);
if (volta !== RICO) {
  throw new Error(`A round trip must return the exact same block, got ${JSON.stringify(volta)}`);
}

// Campo editado troca so o seu valor; os vizinhos voltam intactos.
const editado = buildCandidateHistoryNotes(ida.map((s) => (s.label === "Pontos Fortes" ? { ...s, value: "Pontual." } : s)));
if (parseCandidateHistoryNotes(editado).map((s) => s.label).join("|") !== "Avaliação Técnica|Pontos Fortes|Observações Gerais") {
  throw new Error(`Editing one section must not drop the others, got ${editado}`);
}

// Campo esvaziado some do bloco, e bloco inteiro vazio vira null (a coluna e nullable).
if (parseCandidateHistoryNotes(buildCandidateHistoryNotes([{ label: "Motivo", value: "   " }, { label: "Feedback Interno", value: "ok" }])).length !== 1) {
  throw new Error("An emptied field must disappear from the block");
}
if (buildCandidateHistoryNotes([]) !== null || buildCandidateHistoryNotes([{ label: "Motivo", value: "" }]) !== null) {
  throw new Error("An empty block must be null, not an empty string");
}

// Nota antiga sem rotulo volta sem colchete inventado.
if (buildCandidateHistoryNotes([{ label: null, value: "Texto livre." }]) !== "Texto livre.") {
  throw new Error("An unlabeled note must not gain a label");
}

// Permissao: so Admin (50), e Candidatura Contratada fica fechada para todo mundo.
if (canEditCandidateHistory({ level: 30, applicationStatus: "Entrevista RH" }) !== false) {
  throw new Error("Level 30 registers a stage but must not rewrite an existing record");
}
if (canEditCandidateHistory({ level: 50, applicationStatus: "Entrevista RH" }) !== true) {
  throw new Error("Admin must be able to fix a record of an open application");
}
if (canEditCandidateHistory({ level: 50, applicationStatus: "Contratado" }) !== false) {
  throw new Error("A hired application must stay closed, even for an admin");
}
if (canEditCandidateHistory({ level: 50, applicationStatus: null }) !== true) {
  throw new Error("A record with no application must stay editable by an admin");
}

console.log("buildCandidateHistoryNotes + canEditCandidateHistory passed");
