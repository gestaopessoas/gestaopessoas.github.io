const fs = require('fs');
let code = fs.readFileSync('src/components/CandidateProfileModal.tsx', 'utf8');

const target1 = \import { X, Briefcase, MapPin, Mail, Phone, Calendar, Paperclip, Loader2, FileText, Sparkles, GraduationCap, Building2, Award, CheckCircle2, User, Contact, Info, Heart, DollarSign, Users } from "lucide-react";\;
const replacement1 = \import { X, Briefcase, MapPin, Mail, Phone, Calendar, Paperclip, Loader2, FileText, Sparkles, GraduationCap, Building2, Award, CheckCircle2, User, Contact, Info, Heart, DollarSign, Users, Trash2 } from "lucide-react";\;
code = code.replace(target1, replacement1);

const target2 = \const [loading, setLoading] = useState(true);\;
const replacement2 = \const [loading, setLoading] = useState(true);
  const [retryTick, setRetryTick] = useState(0);\;
code = code.replace(target2, replacement2);

const target3 = \}, [candidateId, employeeId, interviewId, email, candidateName]);\;
const replacement3 = \}, [candidateId, employeeId, interviewId, email, candidateName, retryTick]);

  const handleDeleteInterview = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este registro de etapa?")) return;
    const { error } = await supabase.from("candidate_interviews").delete().eq("id", id);
    if (error) {
      alert("Erro ao excluir entrevista: " + error.message);
      return;
    }
    setRetryTick(t => t + 1);
  };\;
code = code.replace(target3, replacement3);

const target4 = \                    </div>
                  )}
                </div>\;
const replacement4 = \                    </div>
                  )}

                  {activeTab === "history" && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="text-base font-bold text-foreground">Histórico de Etapas / Processos</h3>
                      </div>
                      
                      {candidateInterviews && candidateInterviews.length > 0 ? (
                        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                          {candidateInterviews
                            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                            .map((interview) => (
                              <div key={interview.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                <div className="flex items-center justify-center w-5 h-5 rounded-full border border-white bg-primary text-emerald-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                </div>
                                <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.25rem)] bg-card p-4 rounded-xl border border-border/50 shadow-sm">
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
                                    <div className="text-sm text-muted-foreground bg-muted/20 p-3 rounded-md mb-2">
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
                                    <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                                      <strong>Motivo da recusa:</strong> {interview.rejection_reason}
                                    </div>
                                  )}
                                </div>
                              </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground space-y-2">
                          <Briefcase className="h-8 w-8 mx-auto text-muted-foreground/40" />
                          <p className="font-medium text-foreground">Nenhum histórico de etapas registrado</p>
                          <p className="text-xs">Este candidato ainda não participou de etapas formais registradas no sistema.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>\;
code = code.replace(target4, replacement4);

fs.writeFileSync('src/components/CandidateProfileModal.tsx', code);
