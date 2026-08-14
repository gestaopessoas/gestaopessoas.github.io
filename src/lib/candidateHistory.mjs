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
  const status = String(latest?.candidate_future || latest?.stage || "").trim().toLowerCase();
  return status === "livre" || status === "banco de talentos";
}
