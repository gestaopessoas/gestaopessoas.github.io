// Caminho relativo (e não o alias "@/"): estes .mjs também rodam sob `node --test`.
import { normalizeStage, sameStage, TERMINAL_STAGES } from "../app/dashboard/central-candidato/lib/candidateLogic.mjs";

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

export function canDisplayCandidateContacts(interviews = []) {
  if (!Array.isArray(interviews) || interviews.length === 0) return true;
  const latest = [...interviews].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  )[0];
  const status = normalizeStage(latest?.candidate_future || latest?.stage);
  return status === "livre" || status === "banco de talentos";
}

/**
 * `interviews` não tem candidate_id: o vínculo com o candidato é por e-mail (com o
 * nome como fallback), o mesmo critério do upsert em entrevistas/page.tsx.
 */
function matchInterviewByPerson(query, { email, fullName }) {
  const mail = String(email || "").trim();
  if (mail) return query.ilike("email", mail);
  const name = String(fullName || "").trim();
  if (!name) return null;
  return query.ilike("candidate_name", name);
}

/** Situação da entrevista mais recente do candidato, no formato da prop interviewProgress. */
export async function fetchInterviewProgress(supabase, { email, fullName }) {
  const query = matchInterviewByPerson(
    supabase.from("interviews").select("status, result, destination"),
    { email, fullName }
  );
  if (!query) return null;
  const { data } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  return { status: data.status || "Aguardando", result: data.result || "N/C", destination: data.destination || "" };
}

/**
 * Etapa terminal gravada no histórico manda no destino da entrevista — é o campo que a
 * tela de Entrevistas exibe, e ele não é derivado do histórico (ADR: opção (b) da issue #41).
 */
export async function syncInterviewDestination(supabase, { email = "", fullName = "", stage }) {
  const canonical = TERMINAL_STAGES.find((s) => sameStage(s, stage));
  if (!canonical) return { skipped: true };
  // Só a entrevista mais recente recebe o destino: atualizar por e-mail atingiria
  // também as entrevistas antigas do mesmo candidato.
  const lookup = matchInterviewByPerson(supabase.from("interviews").select("id"), { email, fullName });
  if (!lookup) return { skipped: true };
  const { data: latest, error: lookupError } = await lookup
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) return { error: lookupError };
  if (!latest) return { skipped: true };
  const { error } = await supabase
    .from("interviews")
    .update({ destination: canonical })
    .eq("id", latest.id);
  return { error };
}
