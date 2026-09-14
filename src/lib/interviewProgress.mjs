// A data e a hora andam junto com a situação: entrevista marcada precisa ficar
// registrada mesmo quando a pessoa não compareceu.
export const INTERVIEW_STATUSES = ["Aguardando", "Confirmado", "Compareceu", "Não compareceu", "Desistente"];

/** Não compareceu = faltou sem avisar; Desistente = avisou que saiu do processo. */
export const NO_SHOW_STATUSES = ["Não compareceu", "Desistente"];

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
