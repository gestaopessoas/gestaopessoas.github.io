import { test } from "node:test";
import assert from "node:assert/strict";
import {
  latestInterview,
  isLockedByInterview,
  latestEducationDegree,
  isInterviewStage,
  stageNeedsWorkplace,
  candidateBucket,
  nextStageOptions,
  BUCKET_ORDER,
  STAGE_BUCKETS,
  candidaturaAtual,
  candidaturasAtivas,
  candidateStatusFromApplications,
} from "./candidateLogic.mjs";

const app = (status, created_at, extra = {}) => ({ status, created_at, ...extra });

test("candidaturaAtual: a mais recente por created_at, vazio dá null", () => {
  assert.equal(candidaturaAtual([]), null);
  const lista = [app("Triagem", "2026-07-01"), app("Entrevista RH", "2026-07-10")];
  assert.equal(candidaturaAtual(lista).status, "Entrevista RH");
});

test("candidaturasAtivas: filtra fora as terminais", () => {
  const lista = [app("Contratado", "2026-07-01"), app("Triagem", "2026-07-05"), app("Reprovado", "2026-07-02")];
  const ativas = candidaturasAtivas(lista);
  assert.deepEqual(ativas.map((a) => a.status), ["Triagem"]);
});

test("candidateStatusFromApplications: sem candidatura -> Banco de Talentos", () => {
  const s = candidateStatusFromApplications([], {});
  assert.equal(s.status, "Banco de Talentos");
  assert.equal(s.etapa_atual, null);
  assert.equal(s.total_candidaturas, 0);
});

test("candidateStatusFromApplications: só terminais -> Banco de Talentos com a última etapa", () => {
  const s = candidateStatusFromApplications(
    [app("Reprovado", "2026-07-01"), app("Desistente", "2026-08-01")],
    {}
  );
  assert.equal(s.status, "Banco de Talentos");
  assert.equal(s.etapa_atual, "Desistente");
});

test("candidateStatusFromApplications: uma ativa + uma terminal -> Em Processo com a ativa", () => {
  const s = candidateStatusFromApplications(
    [app("Reprovado", "2026-06-01"), app("Entrevista RH", "2026-08-01")],
    {}
  );
  assert.equal(s.status, "Em Processo");
  assert.equal(s.etapa_atual, "Entrevista RH");
});

test("candidateStatusFromApplications: Contratado", () => {
  const s = candidateStatusFromApplications([app("Contratado", "2026-07-01")], {});
  assert.equal(s.status, "Contratado");
  assert.equal(s.etapa_atual, "Contratado");
});

test("candidateBucket separa os baldes que o adm de obra precisa ver", () => {
  assert.equal(candidateBucket("Banco de Talentos", null), "livre");
  // Candidatura recém-chegada do portal: existe, mas ninguém encostou nela — não é entrevista.
  assert.equal(candidateBucket("Em Processo", "Nova"), "livre");
  assert.equal(candidateBucket("Em Processo", "Triagem"), "entrevista");
  assert.equal(candidateBucket("Em Processo", "Entrevista Gestor"), "entrevista");
  assert.equal(candidateBucket("Em Processo", "Testagem Psicológica"), "entrevista");
  assert.equal(candidateBucket("Em Processo", "Documentação"), "documentacao");
  assert.equal(candidateBucket("Em Processo", "Proposta"), "proposta");
  assert.equal(candidateBucket("Em Processo", "Contratado"), "contratacao");
});

// issue #113: a aba Contratação contava zero sempre porque todo desfecho virava "encerrado".
// O prazo de 30 dias que consertou aquilo caiu: contratado fica na Central, sem expirar.
test("candidateBucket mantém o contratado na Central", () => {
  const dias = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(candidateBucket("Contratado", "Contratado"), "contratacao");
  // A data de contratação deixou de ser argumento: passar uma não muda mais nada.
  assert.equal(candidateBucket("Contratado", "Contratado", dias(3)), "contratacao");
  assert.equal(candidateBucket("Contratado", "Contratado", dias(400)), "contratacao");
  assert.equal(candidateBucket("Contratado", "Contratado", null), "contratacao");
});

test("candidateBucket trata terminais e etapa desconhecida", () => {
  assert.equal(candidateBucket("Contratado", null), "contratacao");
  // Processo ativo com etapa fora do mapa não pode sumir da tela.
  assert.equal(candidateBucket("Em Processo", "Outros"), "entrevista");
  assert.equal(candidateBucket("Em Processo", null), "entrevista");
});

test("todo balde declarado em BUCKET_ORDER é alcançável", () => {
  for (const bucket of BUCKET_ORDER) {
    const etapas = STAGE_BUCKETS[bucket];
    assert.ok(etapas?.length, `${bucket} não tem etapas mapeadas`);
    for (const etapa of etapas) {
      assert.equal(candidateBucket("Em Processo", etapa), bucket);
    }
  }
});

const int = (stage, created_at, extra = {}) => ({ stage, created_at, ...extra });

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
  // Extensão mais recente não vira a escolaridade da linha.
  assert.equal(
    latestEducationDegree([
      { degree: "Extensão em NR-35", end_date: "2025-01-01", is_extension: true },
      { degree: "Médio", end_date: "2019-01-01" },
    ]),
    "Médio"
  );
  assert.equal(latestEducationDegree([{ degree: "NR-35", is_extension: true }]), null);
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

test("etapa de entrevista é reconhecida para marcar data e hora", () => {
  for (const etapa of ["Entrevista RH", "entrevista gestor", "Triagem", "Testagem Psicológica"]) {
    assert.equal(isInterviewStage(etapa), true, etapa);
  }
  for (const etapa of ["Contratado", "Em Obra", "Banco de Talentos", ""]) {
    assert.equal(isInterviewStage(etapa), false, etapa);
  }
});

test("etapas de obra exigem a obra", () => {
  for (const etapa of ["Em Obra", "Aguardando Obra", "Em Avaliação na Obra"]) {
    assert.equal(stageNeedsWorkplace(etapa), true, etapa);
  }
  for (const etapa of ["Entrevista RH", "Banco de Talentos", "Contratado", ""]) {
    assert.equal(stageNeedsWorkplace(etapa), false, etapa);
  }
});

// A Central acompanha o funil; quem contrata, manda para o banco, reprova ou registra
// desistência é decisão de desfecho, do RH. O select de avanço não pode oferecer desfecho.
const DESFECHOS = ["Contratado", "Banco de Talentos", "Reprovado", "Desistente"];

test("nenhum balde oferece desfecho no avanço", () => {
  for (const balde of [...BUCKET_ORDER, "encerrado", "balde-que-nao-existe"]) {
    const opcoes = nextStageOptions(balde);
    for (const desfecho of DESFECHOS) {
      assert.equal(opcoes.includes(desfecho), false, `${balde} ofereceu ${desfecho}`);
    }
  }
});

test("o avanço oferece o balde atual e o seguinte", () => {
  const opcoes = nextStageOptions("entrevista");
  for (const etapa of STAGE_BUCKETS.entrevista) assert.ok(opcoes.includes(etapa), etapa);
  for (const etapa of STAGE_BUCKETS.obras) assert.ok(opcoes.includes(etapa), etapa);
  // Dois baldes adiante não: avanço é um passo por vez.
  assert.equal(opcoes.includes("Proposta"), false);
});

// issue #120: sem isso, chegar em Proposta numa vaga de sede exigia carimbar "Em Obra".
test("vaga da sede pula o balde de obra", () => {
  const opcoes = nextStageOptions("entrevista", "SEDE");
  assert.ok(opcoes.includes("Proposta"));
  for (const etapa of STAGE_BUCKETS.obras) assert.equal(opcoes.includes(etapa), false, etapa);
  // Acento e caixa não são informação: "Sede" é a mesma Obra.
  assert.ok(nextStageOptions("entrevista", "Sede").includes("Proposta"));
  // Obra de verdade continua obrigando a passar por ela.
  assert.equal(nextStageOptions("entrevista", "OBRA CENTRO").includes("Proposta"), false);
});

test("quem está no banco de talentos é chamado para entrevista", () => {
  // O balde de quem está livre não tem etapa própria — a única saída é marcar entrevista,
  // que é o que o botão "Chamar para entrevista" do Banco de Talentos usa.
  const opcoes = nextStageOptions("livre");
  assert.deepEqual(opcoes, STAGE_BUCKETS.entrevista);
});

test("o fim do funil não vira beco sem saída silencioso", () => {
  // "Contratado" é a única etapa do balde `contratacao` e foi filtrada: a lista vazia é o
  // sinal de que contratar tem botão próprio, não que o balde foi esquecido.
  assert.deepEqual(nextStageOptions("contratacao"), []);
  assert.ok(nextStageOptions("documentacao").length > 0);
});

test("o motivo do desfecho só aparece em quem realmente saiu", () => {
  const reprovada = {
    id: "a",
    status: "Reprovado",
    created_at: "2026-09-10",
    outcome_reason: "Expectativa salarial acima da faixa",
    outcome_details: "pediu 20% acima do teto",
  };

  const saiu = candidateStatusFromApplications([reprovada], {});
  assert.equal(saiu.status, "Banco de Talentos");
  assert.equal(saiu.motivo_saida, "Expectativa salarial acima da faixa");
  assert.equal(saiu.motivo_detalhe, "pediu 20% acima do teto");

  // Reprovado numa obra e em processo em outra: mostrar o motivo velho seria mentira.
  const emProcesso = { id: "b", status: "Entrevista RH", created_at: "2026-09-14" };
  const voltou = candidateStatusFromApplications([reprovada, emProcesso], {});
  assert.equal(voltou.status, "Em Processo");
  assert.equal(voltou.motivo_saida, null);
  assert.equal(voltou.motivo_detalhe, null);
});

// issue #128: o seletor so pode oferecer Etapa que a Vaga usa
test("funil da vaga corta as etapas que ela nao usa", () => {
  const todas = nextStageOptions("entrevista");
  assert.ok(todas.length > 1, "o caso so vale se houver mais de uma opcao sem funil");

  const umaSo = nextStageOptions("entrevista", null, [todas[0]]);
  assert.deepEqual(umaSo, [todas[0]]);
});

test("funil nulo ou vazio nao filtra nada", () => {
  const todas = nextStageOptions("entrevista");
  assert.deepEqual(nextStageOptions("entrevista", null, null), todas);
  assert.deepEqual(nextStageOptions("entrevista", null, []), todas);
});

test("funil so com Obrigatorias nao deixa etapa de avanco", () => {
  assert.deepEqual(
    nextStageOptions("entrevista", null, ["Nova", "Contratado", "Reprovado", "Desistente"]),
    [],
  );
});
