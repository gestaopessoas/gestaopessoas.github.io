/**
 * As 13 Etapas canônicas de uma Candidatura (ADR 0006).
 *
 * `job_applications.status` **é** a Etapa — coluna lida direto, sem derivação. Esta lista é a
 * mesma do `check` criado na Fase 1 (`supabase/migrations/20260915160000_...`); mudar uma sem
 * a outra faz a tela oferecer um valor que o banco recusa.
 *
 * Mora em `src/lib/` de propósito, e não numa pasta de tela: os dois lugares de antes
 * (`dashboard/vagas/lib/stages.ts` e `central-candidato/lib/candidateLogic.mjs`) eram pasta de
 * tela, e foi assim que a lista se duplicou e as duas cópias divergiram.
 */
export const STAGES = [
  "Nova",
  "Triagem",
  "Entrevista RH",
  "Entrevista Gestor",
  "Testagem Psicológica",
  "Aguardando Obra",
  "Em Avaliação na Obra",
  "Em Obra",
  "Proposta",
  "Documentação",
  "Processo de MP",
  "Contratado",
  "Reprovado",
  "Desistente",
] as const;

export type Stage = (typeof STAGES)[number];

/**
 * Etapas que encerram o processo. Sair de uma delas é rejeitado pelo banco: reconsiderar um
 * candidato é abrir uma Candidatura nova.
 */
export const TERMINAL_STAGES: readonly Stage[] = ["Contratado", "Reprovado", "Desistente"];

export function isTerminal(stage?: string | null): boolean {
  return !!stage && (TERMINAL_STAGES as readonly string[]).includes(stage);
}
