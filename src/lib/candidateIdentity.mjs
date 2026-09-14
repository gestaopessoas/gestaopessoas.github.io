// Quem é a mesma pessoa? `candidates.email` é NOT NULL UNIQUE e a gravação da entrevista
// usava `upsert onConflict: email` com um e-mail derivado do primeiro nome quando o
// candidato não tinha e-mail — dois homônimos sem e-mail viravam o mesmo cadastro (issue #76).

const PLACEHOLDER_DOMAIN = "sememail.com";

export function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

/** E-mail que identifica alguém. O placeholder do sistema não identifica. */
export function hasRealEmail(email) {
  const value = normalizeEmail(email);
  if (!value || !value.includes("@")) return false;
  return !value.endsWith(`@${PLACEHOLDER_DOMAIN}`);
}

export function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * E-mail de preenchimento para quem não tem: único por cadastro, porque a coluna é única
 * e porque duas pessoas diferentes não podem colidir na mesma chave.
 * `uid` existe para o teste poder fixar o valor.
 */
export function placeholderEmail(fullName, uid = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`) {
  const slug =
    String(fullName ?? "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 40) || "candidato";
  return `${slug}.${uid}@${PLACEHOLDER_DOMAIN}`;
}

/**
 * Por onde procurar o cadastro já existente, na ordem em que cada dado identifica a pessoa.
 * CPF antes do telefone: telefone de casa é compartilhado, CPF não.
 */
export function identityLookups({ email, cpf, phone } = {}) {
  const lookups = [];
  if (hasRealEmail(email)) lookups.push({ column: "email", value: normalizeEmail(email) });
  const documento = onlyDigits(cpf);
  if (documento.length === 11) lookups.push({ column: "cpf", value: cpf });
  const telefone = onlyDigits(phone);
  if (telefone.length >= 10) lookups.push({ column: "phone", value: phone });
  return lookups;
}

/**
 * Procura o candidato pelos dados que identificam a pessoa e devolve o id, ou null.
 * `supabase` entra por parâmetro para este módulo continuar testável sem banco.
 */
export async function findExistingCandidateId(supabase, identity) {
  for (const { column, value } of identityLookups(identity)) {
    const { data } = await supabase
      .from("candidates")
      .select("id")
      .ilike(column, String(value).trim())
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  return null;
}
