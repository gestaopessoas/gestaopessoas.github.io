import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createClient } from "@/utils/supabase/client";
import { Loader2, Calendar, User, Phone, Mail, Building, FileText, Briefcase, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import AddInterviewModal from "./AddInterviewModal";

type CandidateDetailsSheetProps = {
  candidateId: string | null;
  onClose: () => void;
  onRefresh: () => void;
};

export default function CandidateDetailsSheet({
  candidateId,
  onClose,
  onRefresh
}: CandidateDetailsSheetProps) {
  const [loading, setLoading] = useState(false);
  const [candidate, setCandidate] = useState<any>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const supabase = createClient();

  const fetchDetails = async () => {
    if (!candidateId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("candidates")
        .select(`
          *,
          candidate_educations (*),
          candidate_experiences (*),
          job_applications (
            id,
            status,
            notes,
            created_at,
            job_openings (
              title,
              department
            )
          ),
          candidate_interviews (
            id,
            interviewer_name,
            workplace_name,
            stage,
            rejection_reason,
            notes,
            created_at
          )
        `)
        .eq("id", candidateId)
        .single();

      if (error) throw error;
      setCandidate(data);
    } catch (err) {
      console.error("Error fetching candidate details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (candidateId) {
      fetchDetails();
    } else {
      setCandidate(null);
    }
  }, [candidateId]);

  let currentActiveWorkplace = "";
  let isLocked = false;
  if (candidate?.candidate_interviews?.length > 0) {
    const sorted = [...candidate.candidate_interviews].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latest = sorted[0];
    if (latest.stage !== "Reprovado" && latest.stage !== "Desistente" && latest.stage !== "Banco de Talentos" && latest.stage !== "Contratado") {
      currentActiveWorkplace = latest.workplace_name || "";
      isLocked = true;
    }
  }

  return (
    <>
      <Sheet open={!!candidateId} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-2xl">Detalhes do Candidato</SheetTitle>
            <SheetDescription>
              Visualize o histórico completo e interações do candidato.
            </SheetDescription>
          </SheetHeader>

          {loading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
              </section>

              {/* Education Section */}
              <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
                  <Building className="h-5 w-5 text-muted-foreground" />
                  Formação Acadêmica
                </h3>
                {candidate.candidate_educations && candidate.candidate_educations.length > 0 ? (
                  <ul className="space-y-3">
                    {candidate.candidate_educations.map((edu: any) => (
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
                      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((interview: any) => (
                        <div key={interview.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                          <div className="flex items-center justify-center w-5 h-5 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-primary text-slate-500 group-[.is-active]:text-emerald-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                          </div>
                          <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.25rem)] bg-card p-4 rounded border border-border/50 shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-primary">{interview.stage}</span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(interview.created_at).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                            <div className="text-sm mb-2 text-foreground">
                              <strong>Liderança:</strong> {interview.interviewer_name || "N/A"}<br/>
                              <strong>Obra:</strong> {interview.workplace_name || "N/A"}
                            </div>
                            {interview.notes && (
                              <p className="text-sm text-muted-foreground bg-muted/20 p-2 rounded mb-2">
                                {interview.notes}
                              </p>
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
        </SheetContent>
      </Sheet>

      {candidate && (
        <AddInterviewModal 
          isOpen={isAddModalOpen} 
          onClose={() => setIsAddModalOpen(false)} 
          candidateId={candidate.id}
          currentWorkplace={currentActiveWorkplace}
          isLocked={isLocked}
          onSuccess={() => {
            fetchDetails();
            onRefresh();
            setIsAddModalOpen(false);
          }}
        />
      )}
    </>
  );
}
