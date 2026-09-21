/**
 * Onde cada Candidatura está dentro da Admissão.
 *
 * Os três grupos que o RH acompanha — Coleta de documentação, ASO marcado, ASO recebido —
 * NÃO são Etapas (ADR 0011). São leitura de dois fatos que já existem: a data do exame na
 * Candidatura (`aso_scheduled_at`) e o documento "ASO admissional" em `candidate_documents`.
 *
 * Nenhum fato é digitado duas vezes, então não há como os grupos divergirem da realidade —
 * que é o que aconteceria com `ASO Recebido` como Etapa, convivendo com o documento.
 */

/** O `document_type` que representa o exame, igual ao que a tela sobe. */
export const ASO_DOCUMENT = "ASO admissional";

/** Ordem de exibição — é a ordem em que a admissão acontece. */
export const GRUPOS = ["Coleta de documentação", "ASO marcado", "ASO recebido"];

/**
 * @param {Array<{ document_type?: string, status?: string }> | null | undefined} documents
 */
export function asoRecebido(documents) {
  return (documents ?? []).some((d) => d?.document_type === ASO_DOCUMENT && d?.status === "entregue");
}

/**
 * O grupo de uma Candidatura em Admissão.
 *
 * Recebido ganha de marcado, e não o contrário: o documento na mão é o fato mais forte que
 * existe: o ASO que chegou sem ninguém ter registrado a data ainda assim chegou.
 *
 * @param {{ aso_scheduled_at?: string | null, documents?: Array<{ document_type?: string, status?: string }> | null }} admission
 * @returns {string} um dos `GRUPOS`
 */
export function grupoDaAdmissao(admission) {
  if (asoRecebido(admission?.documents)) return "ASO recebido";
  return admission?.aso_scheduled_at ? "ASO marcado" : "Coleta de documentação";
}

/**
 * A data de hoje no formato de `date` do Postgres, pelo relógio local.
 *
 * `new Date().toISOString()` daria o dia em UTC — no fuso do Brasil, exame marcado para hoje
 * apareceria como atrasado depois das 21h.
 *
 * @param {Date} [agora]
 */
export function hojeISO(agora = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
}

/**
 * Exame cuja data já passou e o documento não chegou — é quem o RH precisa cobrar.
 *
 * @param {{ aso_scheduled_at?: string | null, documents?: Array<{ document_type?: string, status?: string }> | null }} admission
 * @param {string} [hoje] data de referência em `YYYY-MM-DD`
 */
export function asoAtrasado(admission, hoje = hojeISO()) {
  if (!admission?.aso_scheduled_at) return false;
  if (asoRecebido(admission?.documents)) return false;
  // Comparação de string funciona e é exata em `YYYY-MM-DD`; `new Date("2026-09-21")` seria
  // meia-noite UTC, e voltaria a errar o dia por fuso.
  return admission.aso_scheduled_at < hoje;
}
