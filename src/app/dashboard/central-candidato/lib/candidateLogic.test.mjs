import { test } from "node:test";
import assert from "node:assert/strict";
import {
  UNLOCK_STAGES,
  latestInterview,
  isLockedByInterview,
  deriveCandidateStatus,
  latestEducationDegree,
  candidateBucket,
  BUCKET_ORDER,
  STAGE_BUCKETS,
  resolveCandidateStatus,
} from "./candidateLogic.mjs";

test("resolveCandidateStatus dá o mesmo veredito para Central e Banco de Talentos", () => {
  // Encaminhado pela tela de Entrevistas, ainda sem registro de entrevista.
  const encaminhado = {
    candidate_interviews: [],
    search_tags: ["Aprovado na Entrevista"],
    available_worksites: ["SEDE"],
  };
  assert.equal(resolveCandidateStatus(encaminhado).status, "Em Processo");
  assert.equal(resolveCandidateStatus(encaminhado).ultimo_chamado, "Encaminhado para: SEDE");

  // Marcação explícita vence a derivação.
  assert.equal(
    resolveCandidateStatus({ candidate_interviews: [], search_tags: ["Banco de Talentos"] }).status,
    "Banco de Talentos"
  );

  // Sem tags, cai na derivação normal.
  assert.equal(resolveCandidateStatus({ candidate_interviews: [] }).status, "Banco de Talentos");
  assert.equal(resolveCandidateStatus({}).status, "Banco de Talentos");
});

test("candidateBucket separa os baldes que o adm de obra precisa ver", () => {
  assert.equal(candidateBucket("Banco de Talentos", null), "livre");
  assert.equal(candidateBucket("Em Processo", "Triagem"), "entrevista");
  assert.equal(candidateBucket("Em Processo", "Entrevista Gestor"), "entrevista");
  assert.equal(candidateBucket("Em Processo", "Testagem Psicológica"), "entrevista");
  assert.equal(candidateBucket("Em Processo", "Coleta de Documentos & Exames"), "documentacao");
  assert.equal(candidateBucket("Em Processo", "Proposta"), "proposta");
  assert.equal(candidateBucket("Em Processo", "Contratado"), "contratacao");
});

test("candidateBucket trata terminais e etapa desconhecida", () => {
  assert.equal(candidateBucket("Contratado", null), "encerrado");
  // Processo ativo com etapa fora do mapa não pode sumir da tela.
  assert.equal(candidateBucket("Em Processo", "Outros"), "entrevista");
  assert.equal(candidateBucket("Em Processo", null), "entrevista");
});

test("todo balde declarado em BUCKET_ORDER é alcançável", () => {
  for (const bucket of BUCKET_ORDER) {
    if (bucket === "livre") continue; // derivado do status, não de uma etapa
    const etapas = STAGE_BUCKETS[bucket];
    assert.ok(etapas?.length, `${bucket} não tem etapas mapeadas`);
    for (const etapa of etapas) {
      assert.equal(candidateBucket("Em Processo", etapa), bucket);
    }
  }
});

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
