import { test } from "node:test";
import assert from "node:assert/strict";
import {
  UNLOCK_STAGES,
  latestInterview,
  isLockedByInterview,
  deriveCandidateStatus,
  latestEducationDegree,
} from "./candidateLogic.mjs";

const int = (stage, created_at, extra = {}) => ({ stage, created_at, ...extra });

test("UNLOCK_STAGES contém os 4 estágios terminais", () => {
  assert.deepEqual(UNLOCK_STAGES, ["Reprovado", "Desistente", "Banco de Talentos", "Contratado"]);
});

test("latestInterview ordena por created_at desc", () => {
  const list = [int("Triagem", "2026-07-01"), int("Entrevista RH", "2026-07-10")];
  assert.equal(latestInterview(list).stage, "Entrevista RH");
  assert.equal(latestInterview([]), null);
  assert.equal(latestInterview(null), null);
});

test("isLockedByInterview: ativo trava, terminais liberam", () => {
  assert.equal(isLockedByInterview(int("Entrevista Gestor", "2026-07-01")), true);
  assert.equal(isLockedByInterview(int("Contratado", "2026-07-01")), false);
  assert.equal(isLockedByInterview(int("Reprovado", "2026-07-01")), false);
  assert.equal(isLockedByInterview(null), false);
});

test("deriveCandidateStatus: sem histórico -> Banco de Talentos", () => {
  assert.deepEqual(deriveCandidateStatus([]), {
    status: "Banco de Talentos",
    etapa_atual: null,
    obra_atual: null,
    ultimo_chamado: "Nenhum contato",
  });
});

test("deriveCandidateStatus: Contratado", () => {
  const s = deriveCandidateStatus([int("Contratado", "2026-07-01", { workplace_name: "Obra X" })]);
  assert.equal(s.status, "Contratado");
  assert.equal(s.obra_atual, "Obra X");
});

test("deriveCandidateStatus: Reprovado -> Banco de Talentos, sem etapa", () => {
  const s = deriveCandidateStatus([int("Reprovado", "2026-07-01", { workplace_name: "Obra X" })]);
  assert.equal(s.status, "Banco de Talentos");
  assert.equal(s.etapa_atual, null);
  assert.equal(s.obra_atual, "Obra X");
});

test("deriveCandidateStatus: ativo -> Em Processo com etapa", () => {
  const s = deriveCandidateStatus([
    int("Entrevista Gestor", "2026-07-05", { workplace_name: "Obra Y", interviewer_name: "Maria" }),
  ]);
  assert.equal(s.status, "Em Processo");
  assert.equal(s.etapa_atual, "Entrevista Gestor");
  assert.equal(s.obra_atual, "Obra Y");
  assert.equal(s.ultimo_chamado, "Maria - Obra Y");
});

test("latestEducationDegree: último por data; fallback sem datas", () => {
  assert.equal(
    latestEducationDegree([
      { degree: "Superior", start_date: "2020-01-01", end_date: "2024-01-01" },
      { degree: "Médio", start_date: "2016-01-01", end_date: "2019-01-01" },
    ]),
    "Superior"
  );
  assert.equal(latestEducationDegree([{ degree: "Médio" }]), "Médio");
  assert.equal(latestEducationDegree([]), null);
});
