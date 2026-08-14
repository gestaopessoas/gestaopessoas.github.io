import { buildCandidateHistoryRecord, canDisplayCandidateContacts } from "./candidateHistory.mjs";

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

if (!canDisplayCandidateContacts([{ candidate_future: "Livre" }])) {
  throw new Error("Contacts must remain visible for a free candidate");
}
if (!canDisplayCandidateContacts([{ candidate_future: "Banco de talentos" }])) {
  throw new Error("Contacts must remain visible for a candidate in the talent pool");
}
if (canDisplayCandidateContacts([{ candidate_future: "Avançar no processo" }])) {
  throw new Error("Contacts must be hidden during an active process");
}
