// Lógica pura compartilhada da Central do Candidato (ESM).
// Fonte única de verdade para estágios do lock e derivação de status/escolaridade.
// Importado por page.tsx/CandidateDetailsSheet.tsx/AddInterviewModal.tsx e testado em candidateLogic.test.mjs.
// ponytail: se tipos ficarem onerosos, migrar para TS com .ts/.tsx — hoje as .d.mts cobrem a fronteira.

export const UNLOCK_STAGES = ["Reprovado", "Desistente", "Banco de Talentos", "Contratado"];

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
  return { status: "Em Processo", etapa_atual: latest.stage, ...base };
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
