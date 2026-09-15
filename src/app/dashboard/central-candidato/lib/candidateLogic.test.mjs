import { test } from "node:test";
import assert from "node:assert/strict";
import {
  UNLOCK_STAGES,
  latestInterview,
  isLockedByInterview,
  deriveCandidateStatus,
  latestEducationDegree,
  isInterviewStage,
  stageNeedsWorkplace,
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

test("candidate_future reflete os filtros da Central", () => {
  const livre = deriveCandidateStatus([int("Em entrevista", "2026-08-14", { candidate_future: "Livre" })]);
  assert.equal(livre.status, "Banco de Talentos");
  assert.equal(candidateBucket(livre.status, livre.etapa_atual), "livre");

  const documentacao = deriveCandidateStatus([int("Coleta de documentos", "2026-08-14", { candidate_future: "Avançar no processo" })]);
  assert.equal(documentacao.status, "Em Processo");
  assert.equal(candidateBucket(documentacao.status, documentacao.etapa_atual), "documentacao");
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

// Issue #72
test("latestEducationDegree: parecer é reserva, e o cadastro continua mandando", () => {
  assert.equal(latestEducationDegree([], { education: "Ensino Médio" }), "Ensino Médio");
  assert.equal(
    latestEducationDegree([], { education: "Ensino Médio", academic_list: [{ course: "Engenharia Civil" }] }),
    "Engenharia Civil"
  );
  assert.equal(
    latestEducationDegree([{ degree: "Superior" }], { education: "Ensino Médio" }),
    "Superior"
  );
  assert.equal(latestEducationDegree([], { education: "" }), null);
});

// Issue #41
test("etapa gravada em minúsculo conta como Banco de Talentos", () => {
  const derived = deriveCandidateStatus([int("banco de talentos", "2026-08-14")]);
  assert.equal(derived.status, "Banco de Talentos");
  assert.equal(derived.etapa_atual, null);
  assert.equal(candidateBucket(derived.status, derived.etapa_atual), "livre");
  assert.equal(isLockedByInterview({ stage: "Banco de talentos" }), false);
});

test("tag prefixada em candidate_future não vira destino Banco de Talentos", () => {
  const derived = deriveCandidateStatus([
    int("Entrevista RH", "2026-08-14", { candidate_future: "Aprovado para Banco de Talentos" }),
  ]);
  assert.equal(derived.status, "Em Processo");
  assert.equal(derived.etapa_atual, "Entrevista RH");
  // Já o valor exato (com outra caixa) é destino de verdade.
  assert.equal(
    deriveCandidateStatus([int("Entrevista RH", "2026-08-14", { candidate_future: "BANCO DE TALENTOS" })]).status,
    "Banco de Talentos"
  );
});

test("candidato sem entrevistas cai no Banco de Talentos", () => {
  for (const entrevistas of [[], null, undefined]) {
    const derived = deriveCandidateStatus(entrevistas);
    assert.equal(derived.status, "Banco de Talentos");
    assert.equal(derived.etapa_atual, null);
    assert.equal(derived.ultimo_chamado, "Nenhum contato");
  }
  assert.equal(resolveCandidateStatus({}).status, "Banco de Talentos");
});

test("contratado e entrevista agendada nunca caem no balde Livres", () => {
  const livre = { search_tags: ["Banco de Talentos"], candidate_interviews: [] };

  const contratado = resolveCandidateStatus({
    ...livre,
    interview_progress: { status: "Compareceu", result: "Aprovado", destination: "Contratado" },
  });
  assert.equal(contratado.status, "Contratado");
  assert.notEqual(candidateBucket(contratado.status, contratado.etapa_atual), "livre");

  for (const status of ["Aguardando", "Confirmado"]) {
    const agendado = resolveCandidateStatus({ ...livre, interview_progress: { status, result: "N/C" } });
    assert.equal(agendado.status, "Em Processo");
    assert.equal(candidateBucket(agendado.status, agendado.etapa_atual), "entrevista");
  }

  // Entrevista já concluída sem destino não mexe no status derivado.
  const concluida = resolveCandidateStatus({
    ...livre,
    interview_progress: { status: "Compareceu", result: "Aprovado", destination: "" },
  });
  assert.equal(concluida.status, "Banco de Talentos");
});

test("etapa de entrevista é reconhecida para marcar data e hora", () => {
  for (const etapa of ["Entrevista RH", "entrevista gestor", "Triagem", "Testagem Psicológica"]) {
    assert.equal(isInterviewStage(etapa), true, etapa);
  }
  for (const etapa of ["Contratado", "Em Obra", "Banco de Talentos", ""]) {
    assert.equal(isInterviewStage(etapa), false, etapa);
  }
});

test("contratado não volta para o Banco de Talentos por causa da tag", () => {
  const contratado = resolveCandidateStatus({
    search_tags: ["Banco de Talentos"],
    candidate_interviews: [
      { stage: "Banco de Talentos", created_at: "2026-08-01" },
      { stage: "Contratado", created_at: "2026-09-01" },
    ],
  });
  assert.equal(contratado.status, "Contratado");
  assert.equal(candidateBucket(contratado.status, contratado.etapa_atual), "encerrado");
});

test("etapas de obra exigem a obra", () => {
  for (const etapa of ["Encaminhado - Obra Específica", "Em Obra", "Aguardando Obra", "Recusado pela Obra"]) {
    assert.equal(stageNeedsWorkplace(etapa), true, etapa);
  }
  for (const etapa of ["Entrevista RH", "Banco de Talentos", "Contratado", ""]) {
    assert.equal(stageNeedsWorkplace(etapa), false, etapa);
  }
});
