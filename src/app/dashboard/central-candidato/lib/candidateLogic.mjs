// Lógica pura compartilhada da Central do Candidato (ESM).
// Fonte única de verdade para estágios do lock e derivação de status/escolaridade.
// Testado em candidateLogic.test.mjs.
// ponytail: se tipos ficarem onerosos, migrar para TS com .ts/.tsx — hoje as .d.mts cobrem a fronteira.

// A situação da entrevista é do evento, e por isso mora em interviewProgress.mjs (ADR 0010).
// Caminho relativo (e não o alias "@/"): estes .mjs também rodam sob `node --test`.
import { PENDING_INTERVIEW_STATUSES } from "../../../../lib/interviewProgress.mjs";

export { PENDING_INTERVIEW_STATUSES };

// A lista canônica das 13 Etapas e o conjunto terminal moram em `src/lib/stages.ts` — aqui
// ficou só o que é da Central: os baldes de visualização (ADR 0006, issue #57).
const TERMINAIS = ["Contratado", "Reprovado", "Desistente"];

/** Etapa que encerra a Candidatura. Sair dela é rejeitado pelo banco. */
export function isTerminalStage(stage) {
  return TERMINAIS.some((s) => sameStage(s, stage));
}

/**
 * Caixa e acento não são informação aqui: "Banco de talentos" gravado pelo modal e
 * "Banco de Talentos" gravado pela tela de Entrevistas são a mesma etapa.
 * Comparação é sempre por igualdade do valor normalizado — nunca por substring,
 * senão a tag "Aprovado para Banco de Talentos" (candidate_future) casaria com a etapa.
 */
export function normalizeStage(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

export function sameStage(a, b) {
  return normalizeStage(a) === normalizeStage(b);
}

// Agrupa as etapas granulares gravadas em candidate_interviews.stage nos baldes que o
// administrativo de obra precisa enxergar. A etapa exata continua visível na linha —
// o balde existe só para filtrar e contar.
export const STAGE_BUCKETS = {
  // "Nova" é a Candidatura recém-chegada do portal de vagas: existe, mas ninguém do RH
  // encostou nela ainda. Sem esta linha ela caía no fallback de `candidateBucket` e a tela
  // dizia "Em entrevista" para quem nunca foi chamado.
  livre: ["Nova"],
  entrevista: ["Triagem", "Entrevista RH", "Entrevista Gestor", "Testagem Psicológica"],
  obras: ["Aguardando Obra", "Em Avaliação na Obra", "Em Obra"],
  proposta: ["Proposta"],
  documentacao: ["Documentação"],
  mp: ["Processo de MP"],
  contratacao: ["Contratado"],
};

/**
 * Etapas que são uma entrevista de verdade: avançar para uma delas marca data e hora e
 * gera registro em `interviews`, senão a entrevista não aparece na agenda nem no relatório.
 */
export function isInterviewStage(stage) {
  return STAGE_BUCKETS.entrevista.some((s) => sameStage(s, stage));
}

/**
 * Etapas que só fazem sentido com uma obra: encaminhar "para obra específica" sem dizer
 * qual obra gravava um registro vazio (QA B2).
 */
export function stageNeedsWorkplace(stage) {
  return STAGE_BUCKETS.obras.some((s) => sameStage(s, stage));
}

/**
 * Etapas que quem não é do RH pode registrar. "Banco de Talentos" saiu: deixou de ser Etapa
 * e virou consulta derivada — encerrar uma Candidatura é decisão de desfecho, do RH.
 */
export const LIMITED_STAGE_OPTIONS = ["Proposta"];

export const BUCKET_ORDER = ["livre", "entrevista", "obras", "proposta", "documentacao", "mp", "contratacao"];

export const BUCKET_LABELS = {
  livre: "Livres",
  entrevista: "Em entrevista",
  obras: "Em Obra",
  proposta: "Proposta",
  documentacao: "Documentação",
  mp: "Processo de MP",
  contratacao: "Contratados (30 dias)",
};

/** Por quantos dias o contratado ainda aparece na aba Contratação (issue #113). */
export const DIAS_NA_ABA_CONTRATACAO = 30;

function contratacaoRecente(contratadoEm) {
  if (!contratadoEm) return false;
  const quando = new Date(contratadoEm).getTime();
  if (Number.isNaN(quando)) return false;
  return Date.now() - quando <= DIAS_NA_ABA_CONTRATACAO * 24 * 60 * 60 * 1000;
}

/**
 * Em qual balde o candidato cai. `encerrado` cobre Reprovado/Desistente — e o Contratado
 * antigo —, que não aparecem na Central.
 *
 * Contratado é o caso especial: a aba Contratação existia e contava zero sempre, porque
 * todo desfecho caía em `encerrado` (issue #113). Agora ele fica visível pelos primeiros
 * `DIAS_NA_ABA_CONTRATACAO` dias e depois sai sozinho — a aba é caixa de saída recente,
 * não arquivo. Sem `contratadoEm` (quem chama sem a data) o comportamento é o antigo.
 */
export function candidateBucket(status, etapaAtual, contratadoEm) {
  if (sameStage(status, "Banco de Talentos")) return "livre";
  if (sameStage(status, "Contratado")) {
    return contratacaoRecente(contratadoEm) ? "contratacao" : "encerrado";
  }
  if (!sameStage(status, "Em Processo")) return "encerrado";

  for (const bucket of BUCKET_ORDER) {
    if (STAGE_BUCKETS[bucket]?.some((s) => sameStage(s, etapaAtual))) return bucket;
  }
  // Etapa ativa porém não mapeada (ex.: "Outros") ainda é um processo em andamento.
  return "entrevista";
}

/**
 * A Obra que não é campo. Vaga da sede não passa por obra nenhuma (issue #120).
 *
 * ponytail: a regra é o nome da Obra cadastrada, porque "SEDE" já existe em `workplaces` e
 * é a única assim. No dia em que houver um segundo local que não é canteiro, o caminho é
 * uma coluna em `workplaces` — não um segundo nome nesta função.
 */
export function isHeadquarters(obra) {
  return sameStage(obra, "SEDE");
}

/**
 * Etapas oferecidas no avanço da Central: as do balde atual (movimento lateral) e as do
 * balde seguinte. Balde desconhecido — ou `livre`, cuja única etapa ("Nova") é o começo e
 * não um destino — começa o funil pela entrevista.
 *
 * Na sede o balde `obras` é pulado: o funil obrigava a marcar "Em Obra" para chegar em
 * Proposta, e o histórico passava a registrar uma passagem por obra que nunca houve.
 *
 * Desfecho não mora aqui. Contratado, Banco de Talentos, Reprovado e Desistente são decisão
 * da entrevista, registrada na ficha em /dashboard/entrevistas: é lá que se contrata ou se
 * manda para o banco. A Central só acompanha o funil, e contratar quem terminou a
 * documentação tem botão próprio no balde `documentacao`.
 *
 * ponytail: quem desiste no meio (obra, proposta) encerra pela ficha da entrevista. Se isso
 * virar atrito no dia a dia, o caminho é um botão "Encerrar processo" na linha — não
 * devolver os desfechos a este select, que foi de onde eles saíram.
 */
// `funilDaVaga` é opcional porque nem toda chamada tem uma Vaga à mão (Candidatura
// Espontânea, ou tela que ainda não buscou `job_requests.stages`) — nesses casos o
// comportamento é o de sempre, as 14 Etapas.
export function nextStageOptions(currentBucket, obra, funilDaVaga) {
  const idx = BUCKET_ORDER.indexOf(currentBucket);
  if (idx === -1) return [...STAGE_BUCKETS.entrevista];

  const stages = [...(STAGE_BUCKETS[currentBucket] ?? [])];
  let proximo = BUCKET_ORDER[idx + 1];
  if (proximo === "obras" && isHeadquarters(obra)) proximo = BUCKET_ORDER[idx + 2];
  if (proximo) stages.push(...(STAGE_BUCKETS[proximo] ?? []));

  // O filtro é a regra, não a montagem acima: "Contratado" é a etapa do balde `contratacao`
  // e voltaria pela porta dos fundos.
  // "Nova" pela mesma razão: é onde a Candidatura nasce, não destino de avanço.
  const desfechos = ["Contratado", "Reprovado", "Desistente", "Nova"];
  const result = [...new Set(stages)].filter((s) => !desfechos.some((d) => sameStage(d, s)));

  if (!Array.isArray(funilDaVaga) || funilDaVaga.length === 0) return result;
  return result.filter((s) => funilDaVaga.some((f) => sameStage(f, s)));
}

export function latestInterview(interviews = []) {
  if (!Array.isArray(interviews) || interviews.length === 0) return null;
  return [...interviews].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];
}

export function isLockedByInterview(latest) {
  return !!latest && !isTerminalStage(latest.stage);
}

/**
 * A Candidatura mais recente do candidato. "Mais recente" e não "mais avançada": a Central
 * mostra em que pé está o processo de agora, e o histórico completo fica a um clique.
 */
export function candidaturaAtual(applications = []) {
  if (!Array.isArray(applications) || applications.length === 0) return null;
  return [...applications].sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  )[0];
}

export function candidaturasAtivas(applications = []) {
  if (!Array.isArray(applications)) return [];
  return applications.filter((a) => !isTerminalStage(a?.status));
}

/**
 * Status do candidato a partir das Candidaturas — não mais derivado do histórico.
 *
 * `job_applications.status` **é** a Etapa (ADR 0006); esta função só decide qual das
 * Candidaturas a linha mostra. Banco de Talentos virou consulta: sem Candidatura ativa e
 * não Contratado. É isso que mata o bug do reprovado — ele tem uma Candidatura em Etapa
 * Terminal `Reprovado`, e Etapa Terminal não é ausência de histórico, então a linha diz
 * "Banco de Talentos — Reprovado" em vez de fingir que o candidato está livre e novo.
 */
export function candidateStatusFromApplications(applications = [], candidate = {}) {
  const ativas = candidaturasAtivas(applications);
  const atualAtiva = candidaturaAtual(ativas);
  const atualQualquer = candidaturaAtual(applications);
  const contratada = (Array.isArray(applications) ? applications : []).find((a) =>
    sameStage(a?.status, "Contratado")
  );

  const referencia = atualAtiva ?? contratada ?? atualQualquer;

  const base = {
    obra_atual: obraDaCandidatura(referencia) || candidate.city || null,
    ultimo_chamado: chamadoDaCandidatura(referencia),
    candidatura_id: referencia?.id ?? null,
    total_candidaturas: Array.isArray(applications) ? applications.length : 0,
    // O motivo só vale quando a Candidatura de referência está em Reprovado/Desistente: em
    // quem foi reprovado numa obra e hoje está em processo em outra, o motivo antigo na tela
    // nova seria mentira.
    motivo_saida: motivoDoDesfecho(referencia),
    motivo_detalhe: motivoDoDesfecho(referencia) ? referencia?.outcome_details ?? null : null,
  };

  if (atualAtiva) {
    return { status: "Em Processo", etapa_atual: atualAtiva.status ?? null, ...base };
  }
  if (contratada) {
    return { status: "Contratado", etapa_atual: "Contratado", ...base };
  }
  // Sem Candidatura ativa e não Contratado: Banco de Talentos. A última Etapa continua
  // visível, porque "por que ele está livre" é a informação que faltava.
  return {
    status: "Banco de Talentos",
    etapa_atual: atualQualquer?.status ?? null,
    ...base,
  };
}

/**
 * Motivo do desfecho, e só quando a Candidatura realmente terminou em Reprovado ou
 * Desistente. Contratado não tem motivo, e Candidatura em andamento também não.
 */
function motivoDoDesfecho(app) {
  if (!app) return null;
  if (!sameStage(app.status, "Reprovado") && !sameStage(app.status, "Desistente")) return null;
  return app.outcome_reason ?? null;
}

function obraDaCandidatura(app) {
  return app?.job_openings?.workplaces?.name ?? app?.job_openings?.workplace_name ?? null;
}

function chamadoDaCandidatura(app) {
  if (!app) return "Nenhum contato";
  const vaga = app.job_requests?.position_title || app.job_requests?.requested_role || null;
  const obra = obraDaCandidatura(app);
  if (vaga && obra) return `${vaga} - ${obra}`;
  return vaga || obra || "Candidatura sem vaga informada";
}

/**
 * Escolaridade da linha: o cadastro (`candidate_educations`) manda, como diz o ADR 0010.
 * Só quando ele está vazio é que o parecer entra como reserva — primeiro a formação
 * detalhada (`academic_list`), depois o campo `education` da ficha, que era o único
 * preenchido em quem só passou por entrevista e ainda assim aparecia "Não informado".
 */
export function latestEducationDegree(educations = [], assessment = null) {
  const fromRegistry = degreeFromEducations(educations);
  if (fromRegistry) return fromRegistry;
  if (!assessment) return null;
  const academic = Array.isArray(assessment.academic_list) ? assessment.academic_list[0] : null;
  const course = academic && (academic.course || academic.degree);
  if (course) return course;
  if (academic) return "Curso Superior / Técnico";
  return assessment.education || null;
}

function degreeFromEducations(educations) {
  if (!Array.isArray(educations) || educations.length === 0) return null;
  const byDate = educations
    .filter((e) => e && (e.end_date || e.start_date))
    .sort(
      (a, b) =>
        new Date((b.end_date || b.start_date) || 0).getTime() -
        new Date((a.end_date || a.start_date) || 0).getTime()
    );
  if (byDate.length > 0) return byDate[0].degree || null;
  return educations[0]?.degree || null;
}
