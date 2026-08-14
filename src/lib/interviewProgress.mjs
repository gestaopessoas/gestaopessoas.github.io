export function normalizeInterviewProgress({ status, result }) {
  if (result === "Aprovado" || result === "Reprovado" || result === "Banco de Talentos") {
    return { status: "Compareceu", result };
  }
  if (result === "Desistente" || status === "Desistente") {
    return { status: "Desistente", result: "Desistente" };
  }
  if (status === "Aguardando" || status === "Confirmado") {
    return { status, result: "N/C" };
  }
  return { status: status || "Aguardando", result: result || "N/C" };
}
