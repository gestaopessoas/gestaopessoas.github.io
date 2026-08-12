"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

import {
  CheckCircle2, XCircle, FileText, Briefcase, GraduationCap,
  Users, Clock, ChevronLeft, ChevronRight, Loader2, AlertCircle
} from "lucide-react";

type Candidate = {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  city?: string;
  state?: string;
  role_interest?: string;
  resume_url?: string;
};

type Application = {
  id: string;
  candidate_id: string;
  status: string;
  match_score: number | null;
  notes: string | null;
  job_request_id: string | null;
  candidates: Candidate | null;
  manager_decision: string | null;
  job_requests?: {
    position_title: string;
    requested_role: string;
    requester_name: string;
    required_requirements?: string;
    desired_requirements?: string;
    manager_expectations?: string;
  } | null;
};

type Interview = {
  id: string;
  candidate_id: string;
  selection_stage?: string;
  interview_date?: string;
  notes?: string;
  curriculum_summary?: string;
  professional_experiences?: unknown[];
  academic_records?: unknown[];
};

const STAGES_FOR_MANAGER = ["Entrevista Gestor", "Entrevista com Gestor", "Entrevista com a Gestão"];

export default function PortalGestorPage() {
  const supabase = createClient();
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [decided, setDecided] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    // Busca candidatos em fase "Entrevista Gestor" via job_applications
    const { data: apps, error: appsErr } = await supabase
      .from("job_applications")
      .select(`
        id, candidate_id, status, match_score, notes, job_request_id, manager_decision,
        candidates (id, full_name, email, phone, city, state, role_interest, resume_url),
        job_requests (position_title, requested_role, requester_name, required_requirements, desired_requirements, manager_expectations)
      `)
      .in("status", STAGES_FOR_MANAGER)
      .order("created_at", { ascending: true });

    if (appsErr) {
      // Fallback: se a tabela estiver vazia, busca de candidate_interviews com estágio gestor
      const { data: interviewList, error: intErr } = await supabase
        .from("candidate_interviews")
        .select("id, candidate_id, selection_stage, interview_date, notes, curriculum_summary, professional_experiences, academic_records")
        .in("selection_stage", STAGES_FOR_MANAGER)
        .order("interview_date", { ascending: false });

      if (intErr) {
        setError("Não há candidatos na fila do gestor no momento.");
      } else {
        setInterviews((interviewList ?? []) as Interview[]);
      }
      setLoading(false);
      return;
    }

    setApplications((apps ?? []) as unknown as Application[]);

    // Busca avaliações já feitas pelo gestor atual
    const { data: evalsDone } = await supabase
      .from("manager_evaluations")
      .select("application_id, decision");

    const map: Record<string, string> = {};
    (evalsDone ?? []).forEach((e: { application_id: string; decision: string }) => {
      map[e.application_id] = e.decision;
    });
    setDecided(map);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const run = async () => { await load(); };
    run();
  }, [load]);

  const current = applications[currentIndex] ?? null;
  const candidate = current?.candidates ?? null;
  const jobRequest = current?.job_requests ?? null;
  const pending = applications.filter(a => !decided[a.id]).length;

  const evaluate = async (decision: "Aprovado" | "Reprovado") => {
    if (!current) return;
    setSaving(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();

    // Insere a avaliação do gestor
    const { error: evalErr } = await supabase.from("manager_evaluations").insert({
      application_id: current.id,
      candidate_id: current.candidate_id,
      job_request_id: current.job_request_id,
      evaluator_id: user?.id ?? null,
      decision,
      comment: comment.trim() || null,
    });

    if (evalErr) {
      setError("Erro ao salvar avaliação: " + evalErr.message);
      setSaving(false);
      return;
    }

    // Atualiza o status da candidatura
    const nextStatus = decision === "Aprovado"
      ? "Testagem Psicológica"
      : "Reprovado";

    await supabase
      .from("job_applications")
      .update({ status: nextStatus, manager_decision: decision })
      .eq("id", current.id);

    setDecided(prev => ({ ...prev, [current.id]: decision }));
    setComment("");
    setSaving(false);

    // Avança para o próximo candidato pendente
    const nextIdx = applications.findIndex((a, i) => i > currentIndex && !decided[a.id]);
    if (nextIdx !== -1) setCurrentIndex(nextIdx);
  };

  // --- Estado de loading ---
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p>Carregando fila de candidatos...</p>
        </div>
      </div>
    );
  }

  // --- Estado sem candidatos ---
  if (applications.length === 0 && interviews.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20 p-8">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <CardTitle>Fila limpa! 🎉</CardTitle>
            <CardDescription className="mt-2">
              Não há candidatos aguardando avaliação no momento.
              O RH irá notificá-lo quando houver novos candidatos indicados para as suas vagas.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const currentDecision = current ? decided[current.id] : null;

  return (
    <div className="min-h-screen bg-muted/20 p-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Portal do Gestor</h1>
            <p className="text-muted-foreground mt-1">
              Avalie os candidatos indicados pelo RH para suas vagas.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 rounded-full border bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
              <Clock className="h-3.5 w-3.5" />
              {pending} pendente{pending !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {applications.length} total
            </span>
          </div>
        </header>

        {/* Navegação entre candidatos */}
        {applications.length > 1 && (
          <div className="mb-4 flex items-center justify-between rounded-lg border bg-card px-4 py-2">
            <Button
              variant="ghost" size="sm"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex(i => i - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Candidato <strong>{currentIndex + 1}</strong> de <strong>{applications.length}</strong>
              {currentDecision && (
                <span className={`ml-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${currentDecision === "Aprovado" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  {currentDecision}
                </span>
              )}
            </span>
            <Button
              variant="ghost" size="sm"
              disabled={currentIndex === applications.length - 1}
              onClick={() => setCurrentIndex(i => i + 1)}
            >
              Próximo <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {current && (
          <div className="grid gap-6 md:grid-cols-[1fr_300px]">
            {/* Dossiê do candidato */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl">{candidate?.full_name ?? "Candidato"}</CardTitle>
                      <CardDescription className="text-base mt-1">
                        {jobRequest
                          ? `Candidato à vaga de ${jobRequest.position_title || jobRequest.requested_role}`
                          : `Status: ${current.status}`}
                      </CardDescription>
                      {(candidate?.city || candidate?.state) && (
                        <p className="text-sm text-muted-foreground mt-1">
                          📍 {[candidate.city, candidate.state].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                    {current.match_score != null && (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                        Match: {current.match_score}%
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">

                  {/* Expectativas do Gestor / Vaga */}
                  {jobRequest?.manager_expectations && (
                    <section>
                      <h3 className="mb-2 flex items-center text-base font-semibold">
                        <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />
                        Expectativas do Gestor para a Vaga
                      </h3>
                      <div className="rounded-lg bg-muted p-4 text-sm leading-relaxed">
                        {jobRequest.manager_expectations}
                      </div>
                    </section>
                  )}

                  {/* Requisitos */}
                  {(jobRequest?.required_requirements || jobRequest?.desired_requirements) && (
                    <section>
                      <h3 className="mb-2 flex items-center text-base font-semibold">
                        <GraduationCap className="mr-2 h-4 w-4 text-muted-foreground" />
                        Requisitos da Vaga
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {jobRequest.required_requirements && (
                          <div className="rounded-lg border bg-card p-3">
                            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Obrigatórios</p>
                            <p className="text-sm">{jobRequest.required_requirements}</p>
                          </div>
                        )}
                        {jobRequest.desired_requirements && (
                          <div className="rounded-lg border bg-card p-3">
                            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Desejáveis</p>
                            <p className="text-sm">{jobRequest.desired_requirements}</p>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Notas do RH */}
                  {current.notes && (
                    <section>
                      <h3 className="mb-2 flex items-center text-base font-semibold">
                        <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                        Observações do RH
                      </h3>
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm leading-relaxed text-amber-900">
                        {current.notes}
                      </div>
                    </section>
                  )}

                  {/* Interesses */}
                  {candidate?.role_interest && (
                    <section>
                      <h3 className="mb-2 flex items-center text-base font-semibold">
                        <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                        Área de Interesse do Candidato
                      </h3>
                      <p className="text-sm text-muted-foreground">{candidate.role_interest}</p>
                    </section>
                  )}

                  {/* Currículo */}
                  {candidate?.resume_url && (
                    <section>
                      <a
                        href={candidate.resume_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                        Abrir Currículo (PDF)
                      </a>
                    </section>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar de ação */}
            <div className="space-y-4">
              <Card className="sticky top-8">
                <CardHeader>
                  <CardTitle>Decisão do Gestor</CardTitle>
                  <CardDescription>
                    {currentDecision
                      ? `Já avaliado: ${currentDecision}`
                      : "Avalie se o candidato avança para a próxima fase."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      Comentário (opcional)
                    </label>
                    <Textarea
                      placeholder="Anotações sobre o candidato para o RH..."
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      className="min-h-[100px] resize-none"
                      disabled={!!currentDecision || saving}
                    />
                  </div>

                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    size="lg"
                    disabled={!!currentDecision || saving}
                    onClick={() => evaluate("Aprovado")}
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-5 w-5" />
                    )}
                    Aprovar — Avançar
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                    size="lg"
                    disabled={!!currentDecision || saving}
                    onClick={() => evaluate("Reprovado")}
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="mr-2 h-5 w-5" />
                    )}
                    Reprovar Candidato
                  </Button>

                  {currentDecision && (
                    <div className={`rounded-md p-3 text-sm text-center font-medium ${currentDecision === "Aprovado" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      ✓ Avaliação registrada: {currentDecision}
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <p className="text-xs text-center w-full text-muted-foreground">
                    A decisão é notificada ao time de RH automaticamente.
                    {currentDecision === "Aprovado" && " Candidato avançará para Testagem Psicológica."}
                  </p>
                </CardFooter>
              </Card>

              {/* Fila resumida */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Fila de Avaliação</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {applications.map((app, idx) => (
                      <button
                        key={app.id}
                        onClick={() => setCurrentIndex(idx)}
                        className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors ${
                          idx === currentIndex
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">
                            {app.candidates?.full_name ?? "Candidato"}
                          </span>
                          {decided[app.id] && (
                            <span className={`shrink-0 text-xs font-semibold ${decided[app.id] === "Aprovado" ? "text-emerald-600" : "text-red-500"}`}>
                              {decided[app.id] === "Aprovado" ? "✓" : "✗"}
                            </span>
                          )}
                          {!decided[app.id] && <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
