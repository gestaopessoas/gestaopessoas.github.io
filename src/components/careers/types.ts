export type Career = {
  id: string;
  status: string;
  cost_center: string | null;
  contract_type: string | null;
  target_date: string | null;
  observations: string | null;
  created_at: string;
  department: string | null;
  salary_min: number | null;
  salary_max: number | null;
  seniority: string | null;
  work_mode: string | null;
  is_pcd_eligible: boolean;
  affirmative_tags: string[];
  profile: {
    title: string | null;
    profile_code: string | null;
    min_education: string | null;
    desired_education: string | null;
    min_experience: string | null;
    desired_experience: string | null;
    knowledge: string | null;
    activities: string | null;
    competencies: string | null;
  } | null;
};

/**
 * Vaga que esconde o salario nao traz `salary_min`/`salary_max`: a migration
 * `20260917150000_vaga_esconde_salario_no_portal` faz o gatilho de publicacao NAO copiar o valor
 * para `job_openings`. Entao "sem salario" aqui cobre dois casos -- a vaga que escondeu e a que
 * nunca informou -- e "A combinar" e verdade nos dois.
 */
export function formatSalaryRange(min: number | null, max: number | null): string {
  if (!min && !max) return "A combinar";
  const fmt = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (min && max && min !== max) return `${fmt(min)} - ${fmt(max)}`;
  return fmt(min || max || 0);
}

/**
 * Quebra os campos de texto livre do perfil (conhecimentos, competências) em itens de lista,
 * sem repetir.
 *
 * Issue #102: `knowledge` e `competencies` são digitados à mão no cadastro do perfil, um por
 * linha ou separados por ";" / "·" / "-". O portal juntava os dois com " · " e jogava tudo
 * numa frase só — e como as duas colunas costumam repetir a mesma lista, a vaga PEDREIRO
 * saiu com "Habilidade manual Organização e limpeza ... Habilidade manual Organização e
 * limpeza", grudado e em dobro.
 *
 * A comparação ignora caixa e acento para não deixar passar "Organização" e "ORGANIZACAO"
 * como itens diferentes, mas o texto exibido é o primeiro que apareceu, como foi digitado.
 */
export function splitProfileList(...fields: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const field of fields) {
    // Hífen só separa quando está cercado de espaço ("Corte a frio - manual"); dentro da
    // palavra ele é parte do item ("Auto-organização").
    for (const raw of (field ?? "").split(/[\n;·•|]|\s[-–—]\s/)) {
      const item = raw.replace(/\s+/g, " ").trim().replace(/^[-–—*•]\s*/, "").replace(/[.,;]+$/, "");
      if (!item) continue;
      const key = item.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }
  return items;
}

export function timeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return "Postada hoje";
  if (days < 30) return `Postada há ${days} dia${days > 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Postada há ${months} ${months > 1 ? "meses" : "mês"}`;
  const years = Math.floor(months / 12);
  return `Postada há ${years} ano${years > 1 ? "s" : ""}`;
}
