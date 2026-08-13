import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { Loader2, Calendar, User, Phone, Mail, Building, FileText, Briefcase, Plus, AlertCircle, Paperclip, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import AddInterviewModal from "./AddInterviewModal";
import { latestInterview, isLockedByInterview } from "@/app/dashboard/central-candidato/lib/candidateLogic.mjs";
import { CandidateProfileModal } from "@/components/CandidateProfileModal";
import { errorMessage } from "@/lib/utils";

type CandidateDetailsSheetProps = {
  candidateId: string | null;
  onClose: () => void;
  onRefresh: () => void;
};

type CandidateEducation = {
  id: string;
  degree: string | null;
  institution_name: string | null;
};

type CandidateInterview = {
  id: string;
  stage: string;
  created_at: string;
  interviewer_name: string | null;
  workplace_name: string | null;
  notes: string | null;
  rejection_reason: string | null;
};

type CandidateDetails = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  resume_url: string | null;
  candidate_educations: CandidateEducation[] | null;
  candidate_interviews: CandidateInterview[] | null;
};

export default function CandidateDetailsSheet({
  candidateId,
  onClose,
  onRefresh
}: CandidateDetailsSheetProps) {
  const [loading, setLoading] = useState(false);
  const [candidate, setCandidate] = useState<CandidateDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [openingResume, setOpeningResume] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<null | "curriculum" | "behavioral">(null);

  const supabase = createClient();

  useEffect(() => {
    if (!candidateId) return;

    const controller = new AbortController();
    let stale = false;

    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { data, error } = await supabase
          .from("candidates")
          .select(`*, candidate_interviews(*), candidate_educations(*)`)
          .eq("id", candidateId)
          .single();

        if (controller.signal.aborted || stale) return;
        if (error) throw error;

        if (data && data.email) {
          const { data: ints } = await supabase.from("interviews").select("email, assessment").eq("email", data.email);
          if (ints && ints.length > 0) {
            let extraEdus: any[] = [];
            ints.forEach(int => {
              if (int.assessment && Array.isArray(int.assessment.academic_list)) {
                int.assessment.academic_list.forEach((ac: any) => {
                  extraEdus.push({
                    id: ac.id || Math.random().toString(),
                    degree: ac.course || "Curso Superior / Técnico",
                    institution_name: ac.institution || "Não informada",
                    start_date: ac.start_year || ac.start_date || null,
                    end_date: ac.end_year || ac.end_date || null,
                  });
                });
              }
            });
            if (extraEdus.length > 0) {
              if (!data.candidate_educations) data.candidate_educations = [];
              extraEdus.forEach(extra => {
                if (!data.candidate_educations.some((existing: any) => (existing.degree || "").toLowerCase() === (extra.degree || "").toLowerCase() && (existing.institution_name || "").toLowerCase() === (extra.institution_name || "").toLowerCase())) {
                  data.candidate_educations.push(extra);
                }
              });
            }
          }
        }

        setCandidate(data);
      } catch (err) {
        if (controller.signal.aborted || stale) return;
        console.error("Error fetching candidate details:", err);
        setCandidate(null);
        setLoadError(errorMessage(err, "Falha ao carregar detalhes do candidato."));
      } finally {
        if (!stale) setLoading(false);
      }
    })();

    return () => {
      stale = true;
      controller.abort();
    };
  }, [candidateId, retryTick]);

  const handleDeleteInterview = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este registro de entrevista?")) return;
    const { error } = await supabase.from("candidate_interviews").delete().eq("id", id);
    if (error) {
      alert("Erro ao excluir entrevista: " + error.message);
      return;
    }
    setRetryTick((t) => t + 1);
    onRefresh();
  };

  const latest = latestInterview(candidate?.candidate_interviews);
  const isLocked = isLockedByInterview(latest);
  const currentActiveWorkplace = isLocked && latest ? latest.workplace_name || "" : "";

  const openResume = async () => {
    if (!candidate?.resume_url) return;
    setOpeningResume(true);
    const { data, error } = await supabase.storage.from("resumes").createSignedUrl(candidate.resume_url, 60);
    setOpeningResume(false);
    if (error || !data) {
      alert("Não foi possível abrir o currículo. Tente novamente.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <>
      <Dialog open={!!candidateId} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl">Detalhes do Candidato</DialogTitle>
            <DialogDescription>
              Visualize o histórico completo e interações do candidato.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : loadError ? (
            <div className="text-center py-12">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-destructive mb-4">Erro ao carregar detalhes: {loadError}</p>
              <Button variant="outline" onClick={() => setRetryTick((t) => t + 1)}>
                Tentar novamente
              </Button>
            </div>
          ) : candidate ? (
            <div className="space-y-8">
              {/* Basic Info Section */}
              <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
                  <User className="h-5 w-5 text-muted-foreground" />
                  Informações Pessoais
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Nome Completo</p>
                    <p className="font-medium">{candidate.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">E-mail</p>
                    <p className="font-medium flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {candidate.email}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <p className="font-medium flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {candidate.phone || "Não informado"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Localização</p>
                    <p className="font-medium">
                      {candidate.city && candidate.state ? `${candidate.city}, ${candidate.state}` : "Não informada"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setActiveModalTab("curriculum")} className="gap-2 font-medium">
                    <FileText className="h-4 w-4 text-primary" />
                    Ver Dossiê / Currículo
                  </Button>
                  {candidate.resume_url && (
                    <Button variant="ghost" size="sm" onClick={openResume} disabled={openingResume} className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                      {openingResume ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5 text-primary" />}
                      Anexo PDF
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setActiveModalTab("behavioral")} className="gap-2 font-medium">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Ver Teste Comportamental
                  </Button>
                </div>
              </section>

              {/* Education Section */}
              <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
                  <Building className="h-5 w-5 text-muted-foreground" />
                  Formação Acadêmica
                </h3>
                {candidate.candidate_educations && candidate.candidate_educations.length > 0 ? (
                  <ul className="space-y-3">
                    {candidate.candidate_educations.map((edu) => (
                      <li key={edu.id} className="bg-muted/30 p-3 rounded-lg">
                        <p className="font-medium">{edu.degree}</p>
                        <p className="text-sm text-muted-foreground">{edu.institution_name}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma formação registrada.</p>
                )}
              </section>

              {/* Interview History */}
              <section className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    Histórico de Entrevistas
                  </h3>
                  <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
                
                {candidate.candidate_interviews && candidate.candidate_interviews.length > 0 ? (
                  <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                    {candidate.candidate_interviews
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((interview) => (
                        <div key={interview.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                          <div className="flex items-center justify-center w-5 h-5 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-primary text-slate-500 group-[.is-active]:text-emerald-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                          </div>
                          <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.25rem)] bg-card p-4 rounded border border-border/50 shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-primary">{interview.stage}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(interview.created_at).toLocaleDateString('pt-BR')}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteInterview(interview.id);
                                  }}
                                  className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  title="Excluir entrevista"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            <div className="text-sm mb-2 text-foreground">
                              <strong>Liderança:</strong> {interview.interviewer_name || "N/A"}<br/>
                              <strong>Obra:</strong> {interview.workplace_name || "N/A"}
                            </div>
                            {interview.notes && (
                              <div className="text-sm text-muted-foreground bg-muted/20 p-3 rounded mb-2">
                                {(() => {
                                  if (!interview.notes.includes('[')) {
                                    return <p className="whitespace-pre-wrap">{interview.notes}</p>;
                                  }
                                  
                                  const parts = interview.notes.split(/\[(.*?)\]/g);
                                  const elements = [];
                                  
                                  if (parts[0] && parts[0].trim()) {
                                    elements.push(<p key="intro" className="whitespace-pre-wrap mb-3">{parts[0].trim()}</p>);
                                  }
                                  
                                  for (let i = 1; i < parts.length; i += 2) {
                                    elements.push(
                                      <div key={i} className="mb-3 last:mb-0">
                                        <span className="text-sm font-semibold text-foreground/90 block mb-0.5">[{parts[i]}]</span>
                                        <p className="whitespace-pre-wrap">{parts[i + 1]?.trim()}</p>
                                      </div>
                                    );
                                  }
                                  
                                  return <div>{elements}</div>;
                                })()}
                              </div>
                            )}
                            {interview.rejection_reason && (
                              <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                                <strong>Motivo da recusa:</strong> {interview.rejection_reason}
                              </div>
                            )}
                          </div>
                        </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum histórico de entrevista registrado para este candidato.
                  </p>
                )}
              </section>

            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Candidato não encontrado.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {candidate && (
        <AddInterviewModal 
          isOpen={isAddModalOpen} 
          onClose={() => setIsAddModalOpen(false)} 
          candidateId={candidate.id}
          currentWorkplace={currentActiveWorkplace}
          isLocked={isLocked}
          onSuccess={() => {
            setRetryTick((t) => t + 1);
            onRefresh();
            setIsAddModalOpen(false);
          }}
        />
      )}

      {activeModalTab && candidate && (
        <CandidateProfileModal 
          candidateId={candidate.id}
          initialTab={activeModalTab}
          onClose={() => setActiveModalTab(null)} 
        />
      )}
    </>
  );
}
