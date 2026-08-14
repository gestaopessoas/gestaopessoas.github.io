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

export function canDisplayCandidateContacts(interviews = []) {
  if (!Array.isArray(interviews) || interviews.length === 0) return true;
  const latest = [...interviews].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  )[0];
  const status = String(latest?.candidate_future || latest?.stage || "").trim().toLowerCase();
  return status === "livre" || status === "banco de talentos";
}
