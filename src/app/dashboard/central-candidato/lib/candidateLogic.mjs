// Lógica pura compartilhada da Central do Candidato (ESM).
// Fonte única de verdade para estágios do lock e derivação de status/escolaridade.
// Importado por page.tsx/CandidateDetailsSheet.tsx/AddInterviewModal.tsx e testado em candidateLogic.test.mjs.
// ponytail: se tipos ficarem onerosos, migrar para TS com .ts/.tsx — hoje as .d.mts cobrem a fronteira.

export const UNLOCK_STAGES = ["Reprovado", "Desistente", "Banco de Talentos", "Contratado"];

// Agrupa as etapas granulares gravadas em candidate_interviews.stage nos baldes que o
// administrativo de obra precisa enxergar. A etapa exata continua visível na linha —
// o balde existe só para filtrar e contar.
export const STAGE_BUCKETS = {
  entrevista: ["Triagem", "Entrevista RH", "Entrevista Gestor", "Testagem Psicológica"],
  documentacao: ["Coleta de Documentos & Exames"],
  contratacao: ["Proposta"],
};

export const BUCKET_ORDER = ["livre", "entrevista", "documentacao", "contratacao"];

export const BUCKET_LABELS = {
  livre: "Livres",
  entrevista: "Em entrevista",
  documentacao: "Documentação",
  contratacao: "Contratação",
};

/**
 * Em qual balde o candidato cai. `encerrado` cobre Contratado/Reprovado/Desistente,
 * que não aparecem na Central.
 */
export function candidateBucket(status, etapaAtual) {
  if (status === "Banco de Talentos") return "livre";
  if (status !== "Em Processo") return "encerrado";

  for (const bucket of BUCKET_ORDER) {
    if (STAGE_BUCKETS[bucket]?.includes(etapaAtual)) return bucket;
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
  return !!latest && !UNLOCK_STAGES.includes(latest.stage);
}

export function deriveCandidateStatus(interviews = []) {
  const latest = latestInterview(interviews);
  if (!latest) {
    return { status: "Banco de Talentos", etapa_atual: null, obra_atual: null, ultimo_chamado: "Nenhum contato" };
  }
  const isTerminal = UNLOCK_STAGES.includes(latest.stage);
  const base = {
    obra_atual: latest.workplace_name || null,
    ultimo_chamado: `${latest.interviewer_name || "Desconhecido"} - ${latest.workplace_name || "Obra não informada"}`,
  };
  if (latest.stage === "Contratado") {
    return { status: "Contratado", etapa_atual: null, ...base };
  }
  if (isTerminal) {
    return { status: "Banco de Talentos", etapa_atual: null, ...base };
  }
  // Se a etapa atual contém "Entrevista", marcar como "Em Entrevista"
  if (latest.stage?.includes("Entrevista")) {
    return { status: "Em Entrevista", etapa_atual: latest.stage, ...base };
  }
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
  if (tags.includes("Banco de Talentos")) status = "Banco de Talentos";

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
