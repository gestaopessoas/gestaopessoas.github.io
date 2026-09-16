/**
 * Motivos de desfecho de uma Candidatura.
 *
 * Não existe "encerrar processo": quem não avança volta ao Banco de Talentos, que é consulta
 * derivada (ADR 0006). O que a tela registra é o DESFECHO — Reprovado ou Desistente — e nos
 * dois o motivo é obrigatório, porque é a única coisa que explica, meses depois, por que a
 * pessoa está livre.
 *
 * Lista fechada de propósito: texto livre não se conta. Quem não se encaixa escolhe "Outro" e
 * escreve, e aí o texto passa a ser obrigatório (o `check` de
 * `20260916140000_desfecho_com_motivo.sql` cobra os dois casos no banco).
 */

import type { Stage } from "./stages";

/** Etapa Terminal que a tela oferece como decisão. "Contratado" tem botão próprio. */
export type Outcome = Extract<Stage, "Reprovado" | "Desistente">;

export const OUTCOME_OTHER = "Outro";

/**
 * "Recusado pela Obra" não é desfecho separado: recusar é reprovar, e o que diferencia é o
 * motivo — falta de experiência, expectativa salarial, restrição da obra.
 */
export const REJECTION_REASONS = [
  "Falta de experiência",
  "Expectativa salarial acima da faixa",
  "Perfil não aderente à vaga",
  "Reprovado em teste psicológico",
  "Restrição da obra",
  "Reprovado na documentação/MP",
  OUTCOME_OTHER,
] as const;

export const WITHDRAWAL_REASONS = [
  "Aceitou outra proposta",
  "Salário abaixo do esperado",
  "Distância / transporte",
  "Horário ou turno",
  "Motivo pessoal / saúde",
  "Não compareceu e não respondeu",
  OUTCOME_OTHER,
] as const;

export const OUTCOME_LABELS: Record<Outcome, string> = {
  Reprovado: "Reprovar",
  Desistente: "Registrar desistência",
};

export function outcomeReasons(outcome: Outcome): readonly string[] {
  return outcome === "Reprovado" ? REJECTION_REASONS : WITHDRAWAL_REASONS;
}

/**
 * Mesma regra do `check` do banco, para a tela recusar antes de bater no servidor. Espelhar
 * é intencional: validar só no cliente deixa o psql e as outras telas passarem por cima.
 */
export function outcomeReasonError(reason: string, details: string): string | null {
  if (!reason.trim()) return "Informe o motivo.";
  if (reason === OUTCOME_OTHER && !details.trim()) return "Descreva o motivo.";
  return null;
}

/** Cor do destaque na lista. Desfecho não é etapa comum — a linha precisa gritar. */
export const OUTCOME_STYLE: Record<Outcome, string> = {
  Reprovado: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  Desistente: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
};

export function isOutcome(stage?: string | null): stage is Outcome {
  return stage === "Reprovado" || stage === "Desistente";
}
