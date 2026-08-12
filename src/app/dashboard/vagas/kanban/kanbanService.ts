import { createClient } from "@/utils/supabase/client";
import { calculateMatchScore } from "@/utils/matchScore";

export type KanbanCandidate = {
  id: string;
  application_id?: string;
  name: string;
  email: string;
  status: string;
  match_score: number;
  tags: string[];
};

type CandidateRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  search_tags: string[] | null;
  behavioral_tags: string[] | null;
};

export async function fetchKanbanData(jobId: string) {
  const supabase = createClient();

  // 1. Fetch Job Request tags
  const { data: job, error: jobError } = await supabase
    .from("job_requests")
    .select("search_tags, behavioral_tags")
    .eq("id", jobId)
    .single();

  if (jobError || !job) throw new Error("Vaga não encontrada");

  const jobTags = [...(job.search_tags || []), ...(job.behavioral_tags || [])];

  // 2. Fetch all candidates and job_applications for this job
  const { data: applications, error: appError } = await supabase
    .from("job_applications")
    .select(`
      id,
      status,
      candidate_id,
      candidates (
        id,
        full_name,
        first_name,
        last_name,
        email,
        search_tags,
        behavioral_tags
      )
    `)
    .eq("job_request_id", jobId);

  if (appError) throw new Error("Erro ao carregar aplicações");

  // 3. Fetch all candidates to find suggestions
  const { data: allCandidates, error: candError } = await supabase
    .from("candidates")
    .select("id, full_name, first_name, last_name, email, search_tags, behavioral_tags");

  if (candError) throw new Error("Erro ao carregar banco de talentos");

  // Process data
  const appliedCandidateIds = new Set(applications?.map(a => a.candidate_id) || []);
  const result: KanbanCandidate[] = [];

  // Add applied candidates
  applications?.forEach(app => {
    const c = app.candidates as unknown as CandidateRow | null;
    if (!c) return;
    const cTags = [...(c.search_tags || []), ...(c.behavioral_tags || [])];
    result.push({
      id: c.id,
      application_id: app.id,
      name: c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Sem nome",
      email: c.email,
      status: app.status,
      match_score: calculateMatchScore(cTags, jobTags),
      tags: cTags
    });
  });

  // Add suggestions (Match > 0 and not applied)
  allCandidates?.forEach(c => {
    if (appliedCandidateIds.has(c.id)) return;
    const cTags = [...(c.search_tags || []), ...(c.behavioral_tags || [])];
    const score = calculateMatchScore(cTags, jobTags);
    if (score > 0) {
      result.push({
        id: c.id,
        name: c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Sem nome",
        email: c.email,
        status: "Sugestões", // virtual status for kanban
        match_score: score,
        tags: cTags
      });
    }
  });

  return result.sort((a, b) => b.match_score - a.match_score);
}
