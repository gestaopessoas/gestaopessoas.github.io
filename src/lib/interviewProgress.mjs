export function normalizeInterviewProgress({ status, result, destination = "" }) {
  if (result === "Aprovado" || result === "Reprovado") {
    return { status: "Compareceu", result, destination: destination || "" };
  }
  if (status === "Desistente") {
    return { status: "Desistente", result: "N/C", destination: destination || "Desistente" };
  }
  if (status === "Aguardando" || status === "Confirmado") {
    return { status, result: "N/C", destination: destination || "" };
  }
  return { status: status || "Aguardando", result: result || "N/C", destination: destination || "" };
}
