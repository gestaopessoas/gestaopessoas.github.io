// Quem aparece no mapa e com qual endereço. Função pura: a tela busca os dados e chama aqui.
// Regra: candidato contratado NÃO é candidato — vira colaborador (o employee Ativo que bate,
// ou "A ADMITIR" quando o cadastro de colaborador ainda não existe).

const ADDRESS_FIELDS = ["address", "address_number", "neighborhood", "city", "state", "cep"] as const;

export type Address = Partial<Record<(typeof ADDRESS_FIELDS)[number], string | null>>;
export type EmployeeRow = Address & { id: string; name: string; cpf?: string | null; workplace_name?: string | null };
export type CandidateRow = Address & { id: string; full_name: string; cpf?: string | null };
export type MapPerson = Address & { id: string; name: string; cpf?: string | null; workplace_name?: string | null };

// Pessoa já localizada, pronta para o mapa.
export type MapPoint = MapPerson & { lat: number; lng: number };

const digits = (v?: string | null) => (v ?? "").replace(/\D/g, "");
const normName = (v?: string | null) => (v ?? "").toUpperCase().trim().replace(/\s+/g, " ");
const hasAddress = (p: Address) => !!p.address?.trim();
const pickAddress = (p: Address): Address => Object.fromEntries(ADDRESS_FIELDS.map((f) => [f, p[f] ?? null]));

export function buildMapPeople(
  employees: EmployeeRow[],
  candidates: CandidateRow[],
  hiredIds: Iterable<string>,
): { colaboradores: MapPerson[]; candidatos: MapPerson[] } {
  const hired = new Set(hiredIds);
  const colaboradores: MapPerson[] = employees.map((e) => ({ ...e }));
  const byCpf = new Map<string, MapPerson>();
  const byName = new Map<string, MapPerson>();
  for (const c of colaboradores) {
    if (digits(c.cpf)) byCpf.set(digits(c.cpf), c);
    byName.set(normName(c.name), c);
  }

  const candidatos: MapPerson[] = [];
  for (const cand of candidates) {
    if (!hired.has(cand.id)) {
      candidatos.push({ id: cand.id, name: cand.full_name, ...pickAddress(cand) });
      continue;
    }
    const emp = byCpf.get(digits(cand.cpf)) ?? byName.get(normName(cand.full_name));
    if (!emp) colaboradores.push({ id: `cand-${cand.id}`, name: cand.full_name, workplace_name: "A ADMITIR", ...pickAddress(cand) });
    else if (!hasAddress(emp)) Object.assign(emp, pickAddress(cand));
  }
  return { colaboradores, candidatos };
}
