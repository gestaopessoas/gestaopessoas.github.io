// Classificação de benefícios pelos nomes REAIS usados no sistema.
// (Os nomes vêm de employee_benefits.benefit_name — ex.: "SulClínica", "OdontoPrev",
// "Convênio com Farmácia", "Vale Refeição", "Vale Transporte", "Cesta basica RG", etc.)
// Decisão (auditoria 2026-08-03): mapear por nome/chave em vez de includes('saúde'),
// que não reconhecia "SulClínica" como plano de saúde e excluía ~51 elegíveis.

export type BenefitKind = "saude" | "odonto" | "farmacia" | "outro";

// Chaves canônicas por categoria — cada entrada contém substrings-chave do nome.
const KINDS: Record<Exclude<BenefitKind, "outro">, string[]> = {
  // SulClínica é o plano de saúde principal.
  saude: ["sulcl", "sul clinica", "sulclínica", "saude", "saúde", "médico", "medico", "hospital", "assist. médica"],
  odonto: ["odonto", "dental", "dentária", "dentaria"],
  farmacia: ["farm", "convênio com farmácia", "convenio com farmacia"],
};

export function classifyBenefitName(name: string | null | undefined): BenefitKind {
  const n = (name || "").toLowerCase();
  if (!n) return "outro";
  if (KINDS.farmacia.some((k) => n.includes(k))) return "farmacia";
  if (KINDS.odonto.some((k) => n.includes(k))) return "odonto";
  if (KINDS.saude.some((k) => n.includes(k))) return "saude";
  return "outro";
}

// true se o colaborador tem benefício do tipo informado (pelos nomes reais).
export function hasBenefitKind(
  benefits: { employee_id: string; benefit_name?: string | null }[],
  employeeId: string,
  kind: BenefitKind
): boolean {
  return benefits.some((b) => b.employee_id === employeeId && classifyBenefitName(b.benefit_name) === kind);
}
