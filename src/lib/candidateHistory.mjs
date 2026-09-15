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

export function canDisplayCandidateContacts(interviews = []) {
  if (!Array.isArray(interviews) || interviews.length === 0) return true;
  const latest = [...interviews].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  )[0];
  const status = normalizeStage(latest?.candidate_future || latest?.stage);
  return status === "livre" || status === "banco de talentos";
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
