import type { SupabaseClient } from "@supabase/supabase-js";

export type Interviewer = {
  id: string;
  name: string;
  role: string | null;
  /** "obra" = coordenador/supervisor/diretor; "rh" = Gestão de Pessoas/RH. */
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
  "coordenador",
  "supervisor",
  "diretor",
];

/** Busca coordenadores, supervisores, diretores, RH e Gestão de Pessoas de todas as obras. */
export async function fetchInterviewers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<Interviewer[]> {
  // Match flexible: tolera variação de grafia/acento no texto livre de employees.role
  const filters = [...interviewRoles, ...hrRoles].map((r) => `role.ilike.%${r}%`).join(",");

  const { data, error } = await supabase
    .from("employees")
    .select("id, name, role")
    .eq("status", "Ativo")
    .or(filters);
  if (error) throw error;

  const isHr = (role: string | null) => hrRoles.some((r) => (role ?? "").toLowerCase().includes(r));
  return (data ?? [])
    .map((e): Interviewer => ({ ...e, origem: isHr(e.role) ? "rh" : "obra" }))
    .sort((a, b) => a.origem.localeCompare(b.origem) || a.name.localeCompare(b.name, "pt-BR"));
}
