// Faixa "De/Até" da vaga (issue #164): cada opção é uma linha da tabela salarial do cargo,
// "Senioridade · Nível — R$", em ordem de salário. Permite "Júnior III até Pleno II".
// Compartilhado entre VagaForm.tsx (dashboard) e solicitar-vaga/page.tsx (formulário público).
import { formatBRL } from "./currency.mjs";
import { levelOrder } from "./salaryLevels.mjs";

const SENIORITY_RANK = { "júnior": 1, "pleno": 2, "sênior": 3 };
const seniorityRank = (s) => SENIORITY_RANK[String(s ?? "").trim().toLowerCase()] ?? 99;
const same = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

// Linhas do cargo na modalidade da vaga (CLT/PJ têm salários diferentes). Sem linha na
// modalidade (ex.: cargo só Estágio), mostra todas e marca a modalidade no rótulo.
export function rangeOptions(rows, roleName, modality) {
  const role = rows.filter((r) => r.role_name === roleName && r.level);
  const inModality = role.filter((r) => r.modality === modality);
  const use = inModality.length > 0 ? inModality : role;
  const showModality = new Set(use.map((r) => r.modality)).size > 1;

  return use
    .map((r) => {
      const name = [r.seniority, r.level].filter(Boolean).join(" · ") + (showModality ? ` (${r.modality})` : "");
      return { ...r, label: r.salary ? `${name} — ${formatBRL(r.salary)}` : name };
    })
    // Salário igual (Júnior V = Pleno II) desempata pela senioridade, depois pelo nível.
    .sort(
      (a, b) =>
        (a.salary ?? 0) - (b.salary ?? 0) ||
        seniorityRank(a.seniority) - seniorityRank(b.seniority) ||
        levelOrder(a.level) - levelOrder(b.level)
    );
}

// Vaga já gravada guarda nível + senioridade; volta para a opção correspondente.
export function findOption(options, level, seniority) {
  if (!level) return undefined;
  return options.find((o) => same(o.level, level) && same(o.seniority, seniority));
}
