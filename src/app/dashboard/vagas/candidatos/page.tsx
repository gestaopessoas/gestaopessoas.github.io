"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { calculateMatchScore, MatchResult } from "@/utils/matchScore";
import { CandidateProfileModal } from "@/components/CandidateProfileModal";
import { useToast } from "@/contexts/ToastContext";
import { PIPELINE_STAGES, normalizeStage } from "../lib/stages";

type Applicant = {
  id: string;
  application_id: string;
  name: string;
  email: string;
  phone: string | null;
  stage: string;
  summary: string;
  match_result: MatchResult;
};

type CandidateRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  professional_summary: string | null;
  experience_summary: string | null;
  search_tags: string[] | null;
  behavioral_tags: string[] | null;
};

async function fetchJobApplicants(jobId: string) {
  const supabase = createClient();

  const { data: job, error: jobError } = await supabase
    .from("job_requests")
    .select("position_title, requested_role, search_tags, behavioral_tags")
    .eq("id", jobId)
    .single();

  if (jobError || !job) throw new Error("Vaga não encontrada");

  const jobTags = [...(job.search_tags || []), ...(job.behavioral_tags || [])];

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
        phone,
        professional_summary,
        experience_summary,
        search_tags,
        behavioral_tags
      )
    `)
    .eq("job_request_id", jobId);

  if (appError) throw new Error("Erro ao carregar candidaturas");

  const applicants: Applicant[] = [];
  (applications ?? []).forEach((app) => {
    const c = app.candidates as unknown as CandidateRow | null;
    if (!c) return;
    const cTags = [...(c.search_tags || []), ...(c.behavioral_tags || [])];
    applicants.push({
      id: c.id,
      application_id: app.id,
      name: c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Sem nome",
      email: c.email,
      phone: c.phone,
      stage: normalizeStage(app.status),
      summary: (c.professional_summary || c.experience_summary || "").trim(),
      match_result: calculateMatchScore(cTags, jobTags),
    });
  });

  applicants.sort((a, b) => b.match_result.score - a.match_result.score);
  return { title: job.position_title || job.requested_role || "Vaga", applicants };
}

function CandidatosContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const { toast } = useToast();

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [jobTitle, setJobTitle] = useState("");
  // Sem `id` na URL não há o que buscar: o estado inicial já é o estado final.
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState(id ? "" : "ID da vaga não fornecido");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    fetchJobApplicants(id)
      .then(({ title, applicants: rows }) => {
        setJobTitle(title);
        setApplicants(rows);
        setError("");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const changeStage = async (applicant: Applicant, stage: string) => {
    const previous = applicant.stage;
    setApplicants((prev) => prev.map((a) => (a.application_id === applicant.application_id ? { ...a, stage } : a)));

    const { error: updateError } = await createClient()
      .from("job_applications")
      .update({ status: stage })
      .eq("id", applicant.application_id);

    if (updateError) {
      setApplicants((prev) => prev.map((a) => (a.application_id === applicant.application_id ? { ...a, stage: previous } : a)));
      toast("Não foi possível atualizar a etapa do candidato.", "error");
      return;
    }
    toast(`${applicant.name} movido para ${stage}.`, "success");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/vagas">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Candidatos da vaga</h1>
          <p className="text-sm text-muted-foreground">{jobTitle || "Carregando..."}</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-destructive/10 text-destructive p-3 rounded-md text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          {id && (
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => { setLoading(true); load(); }}>
              Tentar novamente
            </Button>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border/50 bg-background overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">Nome</th>
                <th className="px-6 py-4 font-medium">Contato</th>
                <th className="px-6 py-4 font-medium">Etapa</th>
                <th className="px-6 py-4 font-medium">Resumo do currículo</th>
                <th className="px-6 py-4 font-medium">% Match</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-muted-foreground">Carregando candidatos...</p>
                  </td>
                </tr>
              ) : applicants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    Nenhum candidato nesta vaga ainda.
                  </td>
                </tr>
              ) : (
                applicants.map((applicant) => (
                  <tr
                    key={applicant.application_id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedCandidateId(applicant.id)}
                  >
                    <td className="px-6 py-4 font-medium text-foreground">{applicant.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span>{applicant.phone || "Sem telefone"}</span>
                        <span className="text-xs text-muted-foreground">{applicant.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={applicant.stage}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => changeStage(applicant, e.target.value)}
                        className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        {PIPELINE_STAGES.map((stage) => (
                          <option key={stage} value={stage}>{stage}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 max-w-sm">
                      {applicant.summary ? (
                        <span className="line-clamp-2 text-muted-foreground" title={applicant.summary}>
                          {applicant.summary}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sem resumo extraído</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex flex-col items-start rounded border px-2 py-1 text-[10px] font-medium ${
                        applicant.match_result.score >= 70
                          ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                          : applicant.match_result.score >= 40
                            ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                            : "bg-zinc-500/10 text-zinc-700 border-zinc-500/20"
                      }`}>
                        <span className="font-bold">{applicant.match_result.score}% Match</span>
                        <span className="text-[9px] opacity-80">
                          {applicant.match_result.matches} de {applicant.match_result.total} palavras-chave
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setSelectedCandidateId(applicant.id); }}
                      >
                        Ver perfil
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCandidateId && (
        <CandidateProfileModal
          candidateId={selectedCandidateId}
          onClose={() => { setSelectedCandidateId(null); load(); }}
        />
      )}
    </div>
  );
}

export default function CandidatosDaVagaPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>}>
      <CandidatosContent />
    </Suspense>
  );
}
