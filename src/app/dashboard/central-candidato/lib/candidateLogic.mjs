// Lógica pura compartilhada da Central do Candidato (ESM).
// Fonte única de verdade para estágios do lock e derivação de status/escolaridade.
// Importado por page.tsx/CandidateDetailsSheet.tsx/AddInterviewModal.tsx e testado em candidateLogic.test.mjs.
// ponytail: se tipos ficarem onerosos, migrar para TS com .ts/.tsx — hoje as .d.mts cobrem a fronteira.

export const UNLOCK_STAGES = ["Reprovado", "Desistente", "Banco de Talentos", "Contratado"];

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

export function isUnlockStage(stage) {
  const normalized = normalizeStage(stage);
  return UNLOCK_STAGES.some((s) => normalizeStage(s) === normalized);
}

/** Etapas que encerram o processo e devem refletir no destino da entrevista. */
export const TERMINAL_STAGES = ["Banco de Talentos", "Reprovado", "Desistente"];

export function isTerminalStage(stage) {
  const normalized = normalizeStage(stage);
  return TERMINAL_STAGES.some((s) => normalizeStage(s) === normalized);
}

// Agrupa as etapas granulares gravadas em candidate_interviews.stage nos baldes que o
// administrativo de obra precisa enxergar. A etapa exata continua visível na linha —
// o balde existe só para filtrar e contar.
export const STAGE_BUCKETS = {
  entrevista: ["Triagem", "Entrevista RH", "Entrevista Gestor", "Testagem Psicológica", "Em entrevista"],
  encaminhado: ["Encaminhado - Pool Geral", "Encaminhado - Obra Específica", "Processo de MPs"],
  obras: ["Aguardando Obra", "Em Avaliação na Obra", "Em Obra"],
  proposta: ["Proposta Pendente", "Proposta em Aprovação RH", "Proposta Aprovada", "Proposta", "Em proposta"],
  documentacao: ["Coleta de Documentos & Exames", "Coleta de documentos", "Aguardando ASO"],
  contratacao: ["Contratado"],
};

/**
 * Fonte única das etapas oferecidas nos selects (modal do candidato, nova entrevista,
 * avanço de etapa). Ordem = ordem dos baldes, terminais no fim.
 */
export const STAGE_OPTIONS = [
  ...new Set([
    ...Object.values(STAGE_BUCKETS).flat(),
    ...UNLOCK_STAGES,
    "Recusado pela Obra",
    "Outros",
  ]),
];

/** Etapas que quem não é do RH pode registrar no histórico. */
export const LIMITED_STAGE_OPTIONS = ["Banco de Talentos", "Em proposta"];

export const BUCKET_ORDER = ["livre", "entrevista", "encaminhado", "obras", "proposta", "documentacao", "contratacao"];

export const BUCKET_LABELS = {
  livre: "Livres",
  entrevista: "Em entrevista",
  encaminhado: "Encaminhados",
  obras: "Em Obra",
  proposta: "Proposta",
  documentacao: "Documentação",
  contratacao: "Contratação",
};

/**
 * Em qual balde o candidato cai. `encerrado` cobre Contratado/Reprovado/Desistente,
 * que não aparecem na Central.
 */
export function candidateBucket(status, etapaAtual) {
  if (sameStage(status, "Banco de Talentos")) return "livre";
  if (!sameStage(status, "Em Processo")) return "encerrado";

  for (const bucket of BUCKET_ORDER) {
    if (STAGE_BUCKETS[bucket]?.some((s) => sameStage(s, etapaAtual))) return bucket;
  }
  // Etapa ativa porém não mapeada (ex.: "Outros") ainda é um processo em andamento.
  return "entrevista";
}

export function latestInterview(interviews = []) {
  if (!Array.isArray(interviews) || interviews.length === 0) return null;
  return [...interviews].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];
}

export function isLockedByInterview(latest) {
  return !!latest && !isUnlockStage(latest.stage);
}

export function deriveCandidateStatus(interviews = []) {
  const latest = latestInterview(interviews);
  if (!latest) {
    return { status: "Banco de Talentos", etapa_atual: null, obra_atual: null, ultimo_chamado: "Nenhum contato" };
  }
  const isTerminal = isUnlockStage(latest.stage);
  const base = {
    obra_atual: latest.workplace_name || null,
    ultimo_chamado: `${latest.interviewer_name || "Desconhecido"} - ${latest.workplace_name || "Obra não informada"}`,
  };
  // Igualdade exata do valor normalizado: a tag "Aprovado para Banco de Talentos"
  // não é o destino "Banco de Talentos" e não pode casar aqui.
  const future = normalizeStage(latest.candidate_future);
  if (future === "livre" || future === "banco de talentos") {
    return { status: "Banco de Talentos", etapa_atual: null, ...base };
  }
  if (future === "encerrar processo") {
    return { status: "Encerrado", etapa_atual: null, ...base };
  }
  if (sameStage(latest.stage, "Contratado")) {
    return { status: "Contratado", etapa_atual: null, ...base };
  }
  if (isTerminal) {
    return { status: "Banco de Talentos", etapa_atual: null, ...base };
  }
  // Toda etapa não terminal é "Em Processo" — é o único status que candidateBucket()
  // reconhece como ativo. A etapa granular vai em etapa_atual e define o balde.
  return { status: "Em Processo", etapa_atual: latest.stage, ...base };
}

/**
 * Status final do candidato, considerando também as tags gravadas pela tela de Entrevistas.
 * Central do Candidato e Banco de Talentos precisam concordar sobre o mesmo candidato —
 * por isso a regra mora aqui, e não duplicada em cada página.
 */
export function resolveCandidateStatus(candidate = {}) {
  const entrevistas = candidate.candidate_interviews;
  const derived = deriveCandidateStatus(entrevistas);
  const tags = Array.isArray(candidate.search_tags) ? candidate.search_tags : [];
  const semEntrevista = !Array.isArray(entrevistas) || entrevistas.length === 0;

  let status = derived.status;
  let ultimo_chamado = derived.ultimo_chamado;

  // Encaminhado pela tela de Entrevistas, ainda sem registro de entrevista na Central.
  if (semEntrevista && tags.includes("Aprovado na Entrevista")) {
    status = "Em Processo";
    const obras =
      Array.isArray(candidate.available_worksites) && candidate.available_worksites.length > 0
        ? candidate.available_worksites.join(", ")
        : candidate.city || "Obra não informada";
    ultimo_chamado = `Encaminhado para: ${obras}`;
  }

  // Marcação explícita de Banco de Talentos vence a derivação.
  if (tags.some((t) => sameStage(t, "Banco de Talentos"))) status = "Banco de Talentos";

  return { ...derived, status, ultimo_chamado };
}

export function latestEducationDegree(educations = []) {
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
