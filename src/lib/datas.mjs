/**
 * Data de hoje em `YYYY-MM-DD`, no fuso de quem está olhando a tela.
 *
 * Existe porque `new Date("2026-09-21")` é meia-noite UTC: no Brasil, o dia anterior. E em
 * `YYYY-MM-DD` a comparação de string é exata, o que torna qualquer objeto Date desnecessário
 * para decidir "venceu" ou "não venceu".
 *
 * @param {Date} [agora]
 */
export function hojeISO(agora = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
}
