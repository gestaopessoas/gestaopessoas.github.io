// Caminho relativo (e não o alias "@/"): estes .mjs também rodam sob `node --test`.
import { normalizeStage } from "../app/dashboard/central-candidato/lib/candidateLogic.mjs";

export function buildCandidateHistoryRecord({
  candidateId,
  stage,
  reason,
  notes,
  workplaceName,
  interviewerName,
  candidateFuture,
}) {
  let formattedNotes = "";
  if (reason) formattedNotes += `[Motivo]\n${reason}\n\n`;
  if (notes) formattedNotes += `[Feedback Interno]\n${notes}\n\n`;

  return {
    candidate_id: candidateId,
    stage,
    rejection_reason: reason || null,
    notes: formattedNotes.trim() || null,
    workplace_name: workplaceName.trim() || null,
    interviewer_name: interviewerName.trim() || null,
    candidate_future: candidateFuture || null,
  };
}

export function getCandidateHistoryTargetId({ candidateId, resolvedCandidateId }) {
  return candidateId || resolvedCandidateId || null;
}

export function buildCandidateFromInterviewProfile(profile = {}) {
  const fullName = String(profile.full_name || profile.name || "").trim();
  const email = String(profile.email || "").trim().toLowerCase();
  if (!fullName || !email) return null;

  const [firstName, ...lastNameParts] = fullName.split(/\s+/);
  return {
    full_name: fullName,
    first_name: firstName,
    last_name: lastNameParts.join(" ") || "Não informado",
    email,
    phone: profile.phone || null,
    city: profile.city || null,
    role_interest: profile.role_interest || profile.role || null,
  };
}

/**
 * `interviews.candidate_id` é o vínculo de verdade (migração 20260914210000). E-mail e nome
 * continuam como fallback enquanto houver linha antiga sem o vínculo preenchido.
 */
function matchInterviewByPerson(query, { candidateId, email, fullName }) {
  const id = String(candidateId || "").trim();
  if (id) return query.eq("candidate_id", id);
  const mail = String(email || "").trim();
  if (mail) return query.ilike("email", mail);
  const name = String(fullName || "").trim();
  if (!name) return null;
  return query.ilike("candidate_name", name);
}

/** Situação da entrevista mais recente do candidato, no formato da prop interviewProgress. */
export async function fetchInterviewProgress(supabase, { candidateId, email = "", fullName = "" }) {
  const query = matchInterviewByPerson(
    // `id` e `role` entram porque quem avança a etapa precisa nomear a entrevista marcada
    // ("15/09 às 09:00 — Pedreiro") e gravar nela o que ocorreu (issue #75).
    supabase.from("interviews").select("id, role, status, result, destination, interview_date, interview_time"),
    { candidateId, email, fullName }
  );
  if (!query) return null;
  const { data } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    role: data.role || "",
    status: data.status || "Aguardando",
    result: data.result || "N/C",
    destination: data.destination || "",
    interview_date: data.interview_date || "",
    interview_time: data.interview_time || "",
  };
}

/**
 * As notas do histórico são gravadas como um bloco só, com rótulos entre colchetes
 * ("[Motivo]\ntexto"). Para a tela mostrar campo a campo, o bloco volta a ser uma lista
 * de { label, value }. Registro antigo, escrito como texto livre, vira um item sem rótulo
 * em vez de sumir da tela.
 */
export function parseCandidateHistoryNotes(notes) {
  const text = String(notes || "").trim();
  if (!text) return [];

  const sections = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const labelMatch = line.match(/^\[(.+)\]$/);
    if (labelMatch) {
      current = { label: labelMatch[1].trim(), lines: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { label: null, lines: [] };
      sections.push(current);
    }
    current.lines.push(line);
  }

  return sections
    .map((section) => ({ label: section.label, value: section.lines.join("\n").trim() }))
    .filter((section) => section.value);
}

/**
 * O caminho de volta de `parseCandidateHistoryNotes`: a lista de { label, value } vira de
 * novo o bloco único gravado em `candidate_interviews.notes`. Existe para a edição do
 * registro (issue #142) não achatar as notas — quem edita mexe num campo de cada vez, e os
 * rótulos que não foram tocados voltam iguais, na mesma ordem.
 */
export function buildCandidateHistoryNotes(sections = []) {
  const texto = (Array.isArray(sections) ? sections : [])
    .map((section) => ({
      label: section?.label ? String(section.label).trim() : null,
      value: String(section?.value ?? "").trim(),
    }))
    .filter((section) => section.value)
    .map((section) => (section.label ? `[${section.label}]\n${section.value}` : section.value))
    .join("\n\n")
    .trim();
  return texto || null;
}

/**
 * Quem pode corrigir um registro já gravado da linha do tempo (issue #142).
 *
 * Duas regras, decididas pelo dono do projeto:
 *   - só Admin (nível 50) — registrar uma Etapa é nível 30, reescrever a de outra pessoa não;
 *   - Candidatura Contratada fica fechada: o histórico até a contratação vira documento.
 *
 * ponytail: a exceção pedida ("editar o registro do rompimento de contrato") não tem alvo
 * hoje — rompimento não é Etapa de `candidate_interviews`, vive em `employees.status`. No dia
 * em que o rompimento virar linha da Etapa, a exceção entra aqui, liberando só esse registro.
 *
 * @param {{ level?: number, applicationStatus?: string | null }} [params]
 */
export function canEditCandidateHistory({ level = 0, applicationStatus = null } = {}) {
  if (Number(level) < 50) return false;
  return normalizeStage(applicationStatus) !== normalizeStage("Contratado");
}
