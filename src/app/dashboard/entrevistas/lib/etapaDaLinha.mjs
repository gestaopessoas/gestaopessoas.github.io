/**
 * A Etapa que uma linha de entrevista mostra.
 *
 * O Destino deixou de ser gravado em `interviews` (ADR 0006, Fase 2), então a coluna passou a
 * ler a Etapa do candidato no histórico. Só que lia a Etapa de HOJE: um candidato que chegou a
 * Contratado aparecia como "Contratado" em todas as suas entrevistas, inclusive na primeira, e
 * a lista perdia justamente o que ela existe para mostrar — por onde a pessoa passou.
 *
 * A Etapa de uma linha é a do momento daquela entrevista. `candidate_interviews` é gravado
 * pelo avanço de Etapa logo ANTES da entrevista ser salva (AdvanceStageModal: primeiro o
 * UPDATE da Candidatura, que dispara o trigger de histórico, depois o INSERT em `interviews`),
 * então a Etapa da linha é o registro de histórico mais recente com data menor ou igual à
 * criação da entrevista.
 */

/**
 * @param {{ candidate_id?: string | null, created_at?: string | null, destination?: string | null }} interview
 * @param {Record<string, Array<{ stage: string, created_at: string | null }>>} historicoPorCandidato
 *   Histórico do candidato em ordem decrescente de `created_at`.
 * @returns {string | null}
 */
export function etapaDaLinha(interview, historicoPorCandidato) {
  const historico = (interview?.candidate_id && historicoPorCandidato?.[interview.candidate_id]) || [];
  const quando = interview?.created_at ?? null;

  const noMomento = quando
    ? historico.find((e) => !e.created_at || e.created_at <= quando)
    : historico[0];

  // Entrevista anterior a todo o histórico (linha antiga, importada antes do eixo único):
  // não há Etapa "daquele dia", então vale o Destino gravado na época e, na falta dele, a
  // Etapa mais antiga que se conhece — melhor que devolver "-" para a linha inteira.
  return noMomento?.stage || interview?.destination || historico[historico.length - 1]?.stage || null;
}

/**
 * Agrupa as linhas de `candidate_interviews` por candidato, preservando a ordem decrescente
 * em que vêm do banco.
 *
 * @param {Array<{ candidate_id?: string | null, stage?: string | null, created_at?: string | null }>} etapas
 * @returns {Record<string, Array<{ stage: string, created_at: string | null }>>}
 */
export function historicoPorCandidato(etapas) {
  const mapa = {};
  for (const etapa of etapas ?? []) {
    if (!etapa?.candidate_id || !etapa?.stage) continue;
    (mapa[etapa.candidate_id] ??= []).push({ stage: etapa.stage, created_at: etapa.created_at ?? null });
  }
  return mapa;
}
