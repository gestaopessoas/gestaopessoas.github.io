// Regras da faixa salarial editada dentro do modal de cargo. Puro, sem tela nem banco.

export const REGIMES = ["CLT", "PJ"];

// Combinação que identifica UMA faixa. Duas linhas com a mesma chave são conflito: o
// preenchimento automático de salário escolheria uma delas sem critério.
export function chaveDaFaixa(f) {
  const base = f.uses_level ? `${f.level ?? ""}|${(f.seniority ?? "").trim().toLowerCase()}` : "sem-nivel";
  return `${f.modality}|${base}`;
}

// "" quando está tudo certo; senão a mensagem para mostrar. Ignora linhas removidas.
export function validarFaixas(faixas) {
  const vivas = faixas.filter((f) => !f.removida);
  const vistas = new Set();
  for (const f of vivas) {
    if (f.uses_level) {
      if (!f.level) return "Toda faixa por nível precisa de um nível.";
      if (!(f.salary > 0)) return `Informe o salário de ${f.modality} ${f.level}.`;
    } else if (f.salary_experience == null || f.salary_after_probation == null) {
      return `Informe os dois salários (experiência e após 90 dias) de ${f.modality}.`;
    }
    const chave = chaveDaFaixa(f);
    if (vistas.has(chave)) {
      return f.uses_level
        ? `${f.modality} ${f.level}${f.seniority ? ` ${f.seniority}` : ""} aparece duas vezes.`
        : `${f.modality} sem nível aparece duas vezes.`;
    }
    vistas.add(chave);
  }
  return "";
}
