// Etapas do funil de uma vaga (`job_applications.status`). Ficavam duplicadas entre o
// antigo Kanban e a tela de métricas; agora é um lugar só.
export const PIPELINE_STAGES = ["Nova", "Triagem", "Entrevista", "Proposta", "Contratado"];

/**
 * A candidatura pública grava "Nova Aplicação" e registros antigos têm status soltos.
 * Tudo que não é uma etapa conhecida cai em "Nova" — mesmo comportamento da primeira
 * coluna do Kanban, que era quem segurava esses casos.
 */
export function normalizeStage(status?: string | null): string {
  return status && PIPELINE_STAGES.includes(status) ? status : "Nova";
}
