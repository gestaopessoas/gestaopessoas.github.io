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

/**
 * As Etapas que têm alguém, na ordem do funil — para agrupar/filtrar uma lista de Candidaturas.
 *
 * Etapa vazia não vira coluna: nenhuma vaga usa as 14 de uma vez, e coluna vazia só ocupa tela.
 * Valor fora de `STAGES` (linha antiga, gravada antes do `check` da Fase 1) vai pro fim em vez
 * de sumir: candidato invisível é pior que Etapa estranha.
 */
export function stagesPresent(counts: Map<string, number>): string[] {
  const conhecidas: string[] = STAGES.filter((s) => counts.has(s));
  const outras = [...counts.keys()].filter((s) => !(STAGES as readonly string[]).includes(s));
  return [...conhecidas, ...outras];
}

/**
 * As Etapas que toda Vaga tem, escolha ela o que escolher.
 *
 * `Nova` é por onde a Candidatura entra — sem ela a vaga não recebe ninguém. As três Terminais
 * são por onde ela sai: vaga que não pode reprovar deixa candidato presa no funil para sempre.
 */
export const OBLIGATORY_STAGES: readonly Stage[] = ["Nova", ...TERMINAL_STAGES];

/**
 * O funil de uma Vaga: o subconjunto das 13 que ela escolheu, na ordem canônica.
 *
 * A ordem **não** é configurável, e isso é decisão, não preguiça: ela vem de `STAGES`. Deixar a
 * vaga reordenar significaria "Contratado" antes de "Triagem", e nenhuma tela que hoje pergunta
 * "que etapa vem depois" sobreviveria a isso.
 *
 * Vaga sem configuração (`null`, e é o caso de toda vaga que já existe) usa as 13 — assim a
 * coluna nasce vazia sem backfill e sem mudar o comportamento de ninguém.
 *
 * As Obrigatórias entram mesmo que não venham na lista: a checagem do banco recusa sem elas,
 * mas quem lê não deve depender disso para não montar uma tela quebrada.
 */
export function jobStages(configured?: readonly string[] | null): Stage[] {
  if (!configured || configured.length === 0) return [...STAGES];
  const escolhidas = new Set<string>([...configured, ...OBLIGATORY_STAGES]);
  return STAGES.filter((s) => escolhidas.has(s));
}
