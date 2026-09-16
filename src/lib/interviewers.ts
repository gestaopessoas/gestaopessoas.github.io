import type { SupabaseClient } from "@supabase/supabase-js";

export type Interviewer = {
  id: string;
  name: string;
  role: string | null;
  /** "obra" = liderança lotada na obra escolhida; "rh" = Gestão de Pessoas/RH, entrevista para qualquer obra. */
  origem: "obra" | "rh";
};

// Gestão de Pessoas / RH entrevista para qualquer obra — não depende de lotação.
export const hrRoles = [
  "gestão de pessoas",
  "gestao de pessoas",
  "recursos humanos",
  "de rh",
  "psicólog",
  "psicolog",
];

// Roles that can conduct interviews in obras
export const interviewRoles = [
  "coordenador de obras",
  "mestre de obras",
  "analista técnico",
  "analista técnico(a) - obras",
  "encarregado",
  "supervisor(a) administrativo(a)",
  "diretor operacional",
  "gestor",
  "gerente",
  "coordenador",
  "administrativo de obras",
];

/** Busca lideranças lotadas na obra + toda a Gestão de Pessoas / RH, deduplicadas por id. */
export async function fetchInterviewers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  workplaceId: string
): Promise<Interviewer[]> {
  // Match flexible: tolera variação de grafia/acento no texto livre de employees.role
  const leadershipFilters = interviewRoles.map((r) => `role.ilike.%${r}%`).join(",");
  const hrFilters = hrRoles.map((r) => `role.ilike.%${r}%`).join(",");

  // Duas consultas: lideranças são restritas à obra, RH não é.
  const [obraRes, hrRes] = await Promise.all([
    supabase
      .from("employees")
      .select("id, name, role")
      .eq("status", "Ativo")
      .eq("workplace_id", workplaceId)
      .or(leadershipFilters),
    supabase
      .from("employees")
      .select("id, name, role")
      .eq("status", "Ativo")
      .or(hrFilters),
  ]);
  if (obraRes.error) throw obraRes.error;
  if (hrRes.error) throw hrRes.error;

  // RH depois da obra: se a pessoa é das duas, prevalece "obra" (está lotada ali).
  const porId = new Map<string, Interviewer>();
  for (const e of hrRes.data ?? []) porId.set(e.id, { ...e, origem: "rh" });
  for (const e of obraRes.data ?? []) porId.set(e.id, { ...e, origem: "obra" });

  return [...porId.values()].sort(
    (a, b) => a.origem.localeCompare(b.origem) || a.name.localeCompare(b.name, "pt-BR")
  );
}
