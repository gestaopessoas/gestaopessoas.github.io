import { buildCandidateHistoryRecord, buildCandidateFromInterviewProfile, getCandidateHistoryTargetId, parseCandidateHistoryNotes } from "./candidateHistory.mjs";

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
