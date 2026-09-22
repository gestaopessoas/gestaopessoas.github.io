import { hojeISO } from "../../../../lib/datas.mjs";

/** O Onboarding dura 90 dias corridos a partir da admissão. Depois disso, encerra. */
export const JANELA_DIAS = 90;

/**
 * Marcos do contrato de experiência da CLT, que é 45+45.
 *
 * São só badge na tela: nada dispara neles. Decisão consciente do dono do produto,
 * registrada em docs/superpowers/specs/2026-09-22-onboarding-design.md.
 */
export const MARCOS = [45, 90];

/**
 * Dias corridos entre a admissão e hoje. `null` quando não há data de admissão — que é
 * diferente de zero: zero é quem entrou hoje.
 *
 * @param {string | null | undefined} admissionDate data em `YYYY-MM-DD`
 * @param {string} [hoje]
 */
export function diasDeCasa(admissionDate, hoje = hojeISO()) {
  if (!admissionDate) return null;
  // Meio-dia nos dois lados: assim o horário de verão não tira nem põe um dia na conta.
  const de = new Date(`${admissionDate}T12:00:00`);
  const ate = new Date(`${hoje}T12:00:00`);
  return Math.floor((ate.getTime() - de.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * O maior marco já atingido, ou `null` antes do primeiro.
 *
 * @param {number | null} dias
 */
export function marcoAtingido(dias) {
  if (dias === null || dias === undefined) return null;
  const atingidos = MARCOS.filter((m) => dias >= m);
  return atingidos.length ? atingidos[atingidos.length - 1] : null;
}

/**
 * Tarefa aberta cujo prazo já passou. Vence no dia SEGUINTE ao `due_date`: o combinado é
 * "até essa data", então no próprio dia ainda dá tempo.
 *
 * @param {{ due_date?: string | null, completed?: boolean }} tarefa
 * @param {string} [hoje]
 */
export function tarefaAtrasada(tarefa, hoje = hojeISO()) {
  if (!tarefa?.due_date) return false;
  if (tarefa.completed) return false;
  return tarefa.due_date < hoje;
}

/**
 * @param {Array<{ completed?: boolean }>} tarefas
 */
export function progresso(tarefas) {
  const total = tarefas?.length ?? 0;
  const feitas = (tarefas ?? []).filter((t) => t.completed).length;
  return { feitas, total, pct: total === 0 ? 0 : Math.round((feitas / total) * 100) };
}
