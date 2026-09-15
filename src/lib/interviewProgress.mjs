// A data e a hora andam junto com a situação: entrevista marcada precisa ficar
// registrada mesmo quando a pessoa não compareceu.
export const INTERVIEW_STATUSES = ["Aguardando", "Confirmado", "Compareceu", "Não compareceu", "Desistente"];

/** Não compareceu = faltou sem avisar; Desistente = avisou que saiu do processo. */
export const NO_SHOW_STATUSES = ["Não compareceu", "Desistente"];

/** Situação de entrevista que ainda vai acontecer: o encontro está marcado, não resolvido. */
export const PENDING_INTERVIEW_STATUSES = ["Aguardando", "Confirmado"];

/**
 * O que a pessoa pode registrar sobre uma entrevista marcada na hora de avançar a etapa.
 * "Aguardando"/"Confirmado" não entram: seguir o processo sem dizer o que houve no
 * encontro é o que deixava a entrevista marcada e invisível (issue #75).
 */
export const INTERVIEW_OUTCOME_OPTIONS = ["Compareceu", "Não compareceu", "Desistente"];

/**
 * Entrevista marcada e ainda não resolvida, com data de hoje em diante. É a que continua
 * na Agenda depois de um avanço de etapa, e por isso precisa ser registrada antes dele.
 * `today` no formato en-CA (AAAA-MM-DD), que é como `interview_date` é gravado.
 */
export function pendingScheduledInterview(progress, today) {
  const data = String(progress?.interview_date || "").trim();
  if (!data) return null;
  if (!PENDING_INTERVIEW_STATUSES.includes(progress.status)) return null;
  return data >= today ? progress : null;
}

/**
 * O registro da entrevista está completo? "Compareceu" sem resultado não diz o que
 * ocorreu, e é justamente o que a issue #75 exige antes de avançar.
 */
export function interviewOutcomeComplete({ status, result } = {}) {
  if (!INTERVIEW_OUTCOME_OPTIONS.includes(status)) return false;
  if (status === "Compareceu") return result === "Aprovado" || result === "Reprovado";
  return true;
}

export function normalizeInterviewProgress({ status, result, destination = "", interview_date = "", interview_time = "" }) {
  const quando = { interview_date: interview_date || "", interview_time: interview_time || "" };
  // Quem não apareceu não tem resultado de entrevista, mesmo que alguém tenha marcado antes.
  if (status === "Desistente") {
    return { status, result: "N/C", destination: destination || "Desistente", ...quando };
  }
  if (status === "Não compareceu") {
    return { status, result: "N/C", destination: destination || "", ...quando };
  }
  if (result === "Aprovado" || result === "Reprovado") {
    return { status: "Compareceu", result, destination: destination || "", ...quando };
  }
  if (status === "Aguardando" || status === "Confirmado") {
    return { status, result: "N/C", destination: destination || "", ...quando };
  }
  return { status: status || "Aguardando", result: result || "N/C", destination: destination || "", ...quando };
}

/**
 * Etapa do histórico (candidate_interviews.stage) equivalente à situação da entrevista.
 * Os valores precisam existir no check de candidate_interviews_stage_check.
 */
export function interviewHistoryStage({ status, result, destination } = {}) {
  const dest = String(destination || "").trim();
  if (dest === "Contratado") return "Contratado";
  if (dest === "Banco de Talentos") return "Banco de Talentos";
  if (dest === "Descartado") return "Reprovado";
  if (dest === "Desistente" || status === "Desistente") return "Desistente";
  if (result === "Reprovado") return "Reprovado";
  return "Entrevista RH";
}

/** Situação mudou? Usado para não poluir o histórico com salvamentos que não mexem nela. */
export function interviewProgressChanged(before = {}, after = {}) {
  return (
    (before.status || "") !== (after.status || "") ||
    (before.result || "") !== (after.result || "") ||
    (before.destination || "") !== (after.destination || "")
  );
}

/**
 * Data e hora marcadas da entrevista, para o histórico. Vale também para quem não
 * compareceu: o que interessa é quando a entrevista foi agendada.
 */
export function formatInterviewSchedule(date, time) {
  const dia = String(date || "").trim();
  const hora = String(time || "").trim();
  if (!dia && !hora) return "Data não informada";
  const [ano, mes, resto] = dia.split("-");
  const diaBR = resto ? `${resto.slice(0, 2)}/${mes}/${ano}` : dia;
  if (!diaBR) return `Horário: ${hora}`;
  return hora ? `${diaBR} às ${hora}` : diaBR;
}

/**
 * Trocar a vaga de uma entrevista já salva apaga o registro (e o parecer) da vaga anterior.
 * Quando isso acontece, a tela pergunta se é para criar uma entrevista nova.
 */
export function roleChangedOnSavedInterview(interviewId, roleAnterior, roleNova) {
  if (!interviewId) return false;
  const antes = String(roleAnterior || "").trim();
  const depois = String(roleNova || "").trim();
  return Boolean(antes) && Boolean(depois) && antes !== depois;
}
