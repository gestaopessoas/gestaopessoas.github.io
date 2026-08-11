"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { X, Briefcase, MapPin, Mail, Phone, Calendar, Paperclip, Loader2, FileText, Sparkles, GraduationCap, Building2, Award, CheckCircle2, User, Contact, Info, Heart, DollarSign, Users } from "lucide-react";

type BigFiveResult = {
  id: string;
  created_at: string;
  openness_score: number | null;
  conscientiousness_score: number | null;
  extraversion_score: number | null;
  agreeableness_score: number | null;
  neuroticism_score: number | null;
};

type CandidateProfileModalProps = {
  candidateId?: string | null;
  employeeId?: string | null;
  interviewId?: string | null;
  email?: string | null;
  candidateName?: string | null;
  initialTab?: "curriculum" | "behavioral";
  onClose: () => void;
};

export function CandidateProfileModal({
  candidateId,
  employeeId,
  interviewId,
  email,
  candidateName,
  initialTab = "curriculum",
  onClose,
}: CandidateProfileModalProps) {
  const [activeTab, setActiveTab] = useState<"curriculum" | "behavioral">(initialTab);
  const [person, setPerson] = useState<any>(null);
  const [results, setResults] = useState<BigFiveResult[]>([]);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [educations, setEducations] = useState<any[]>([]);
  const [experiences, setExperiences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingResume, setOpeningResume] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const openResume = async () => {
    if (!person?.resume_url) return;
    setOpeningResume(true);
    const supabase = createClient();
    const { data, error } = await supabase.storage.from("resumes").createSignedUrl(person.resume_url, 60);
    setOpeningResume(false);
    if (error || !data) {
      alert("Não foi possível abrir o currículo. Tente novamente.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  // Fecha com ESC
  useEffect(() => {
    if (!candidateId && !employeeId && !interviewId && !email && !candidateName) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [candidateId, employeeId, interviewId, email, candidateName, onClose]);

  // Foco
  useEffect(() => {
    if (!candidateId && !employeeId && !interviewId && !email && !candidateName) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      restoreRef.current?.focus?.();
    };
  }, [candidateId, employeeId, interviewId, email, candidateName]);

  useEffect(() => {
    if (!candidateId && !employeeId && !interviewId && !email && !candidateName) return;
    
    let active = true;
    const loadProfile = async () => {
      setLoading(true);
      const supabase = createClient();
      
      let personData: any = null;
      let resultsData: BigFiveResult[] = [];
      let educationsData: any[] = [];
      let interviewsData: any[] = [];

      // 1. Resolver dados da Pessoa (Candidato, Colaborador ou via Entrevista)
      if (candidateId) {
        const { data } = await supabase.from("candidates").select("*").eq("id", candidateId).maybeSingle();
        if (data) personData = data;
      } else if (employeeId) {
        const { data } = await supabase.from("employees").select("*").eq("id", employeeId).maybeSingle();
        if (data) personData = data;
      }

      if (!personData && email) {
        const { data } = await supabase.from("candidates").select("*").eq("email", email).maybeSingle();
        if (data) personData = data;
      }

      if (!personData && candidateName) {
        const { data } = await supabase.from("candidates").select("*").ilike("full_name", candidateName).maybeSingle();
        if (data) personData = data;
      }

      // Se ainda não achou na tabela candidates/employees, mas temos interviewId ou nome/email, buscar em interviews
      if (!personData && (interviewId || email || candidateName)) {
        let query = supabase.from("interviews").select("*");
        if (interviewId) query = query.eq("id", interviewId);
        else if (email) query = query.eq("email", email);
        else if (candidateName) query = query.ilike("candidate_name", candidateName);
        
        const { data: intData } = await query.limit(1).maybeSingle();
        if (intData) {
          personData = {
            id: intData.id,
            full_name: intData.candidate_name,
            email: intData.email,
            phone: intData.phone,
            role_interest: intData.role,
            city: intData.assessment?.worksite || "Não especificado",
            isFromInterview: true
          };
        }
      }

      if (!active || !personData) {
        if (active) setLoading(false);
        return;
      }

      const targetCandId = personData.id && !personData.isFromInterview ? personData.id : candidateId;
      const targetEmpId = employeeId || (personData.role && !personData.role_interest ? personData.id : null);
      const personEmail = personData.email || email;
      const personName = personData.full_name || personData.name || candidateName;

      // 2. Buscar resultados do Big Five
      if (targetCandId) {
        const { data } = await supabase.from("candidate_big_five_results").select("*").eq("candidate_id", targetCandId).order("created_at", { ascending: false });
        if (data) resultsData = data;
      }
      if (!resultsData.length && targetEmpId) {
        const { data } = await supabase.from("candidate_big_five_results").select("*").eq("employee_id", targetEmpId).order("created_at", { ascending: false });
        if (data) resultsData = data;
      }
      if (!resultsData.length && personEmail) {
        const { data } = await supabase.from("candidate_big_five_results").select("*").eq("candidate_email", personEmail).order("created_at", { ascending: false });
        if (data) resultsData = data;
      }

      // 3. Buscar formações (candidate_educations)
      if (targetCandId) {
        const { data } = await supabase.from("candidate_educations").select("*").eq("candidate_id", targetCandId).order("start_date", { ascending: false });
        if (data) educationsData = data;
      }

      // 4. Buscar entrevistas (tabela interviews) do colaborador/candidato
      if (personEmail || personName || interviewId) {
        let intQuery = supabase.from("interviews").select("*").order("interview_date", { ascending: false });
        if (interviewId) {
          intQuery = intQuery.eq("id", interviewId);
        } else if (personEmail && personName) {
          intQuery = intQuery.or(`email.ilike.${personEmail},candidate_name.ilike.${personName}`);
        } else if (personEmail) {
          intQuery = intQuery.ilike("email", personEmail);
        } else if (personName) {
          intQuery = intQuery.ilike("candidate_name", personName);
        }
        const { data } = await intQuery;
        if (data) interviewsData = data;
      }

      // Extrair formações e experiências estruturadas de assessments de entrevistas
      const extractedEdu: any[] = [...educationsData];
      const extractedExp: any[] = [];

      interviewsData.forEach((int) => {
        if (int.assessment) {
          if (Array.isArray(int.assessment.academic_list)) {
            int.assessment.academic_list.forEach((ac: any) => {
              if (!extractedEdu.some(existing => (existing.course || existing.degree || "").toLowerCase() === (ac.course || "").toLowerCase() && (existing.institution || "").toLowerCase() === (ac.institution || "").toLowerCase())) {
                extractedEdu.push({
                  id: ac.id || Math.random().toString(),
                  degree: ac.course || "Curso Superior / Técnico",
                  course: ac.course,
                  institution: ac.institution,
                  status: ac.status || "Concluído",
                  start_date: ac.start_year || ac.start_date,
                  end_date: ac.end_year || ac.end_date
                });
              }
            });
          }
          if (Array.isArray(int.assessment.experience_list)) {
            int.assessment.experience_list.forEach((ex: any) => {
              if (!extractedExp.some(existing => (existing.company || "").toLowerCase() === (ex.company || "").toLowerCase() && (existing.role || "").toLowerCase() === (ex.role || "").toLowerCase())) {
                extractedExp.push({
                  id: ex.id || Math.random().toString(),
                  role: ex.role,
                  company: ex.company,
                  current: ex.current || false,
                  start_date: ex.start_date,
                  end_date: ex.end_date,
                  activities: ex.activities
                });
              }
            });
          }
        }
      });

      if (!active) return;
      
      setPerson(personData);
      setResults(resultsData);
      setEducations(extractedEdu);
      setExperiences(extractedExp);
      setInterviews(interviewsData);
      setLoading(false);
    };

    loadProfile();
    return () => { active = false; };
  }, [candidateId, employeeId, interviewId, email, candidateName]);

  if (!candidateId && !employeeId && !interviewId && !email && !candidateName) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Perfil do Candidato"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl border outline-none animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/30">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Perfil do Colaborador / Candidato</h2>
              <p className="text-xs text-muted-foreground">Visão unificada do histórico profissional, entrevistas e comportamental</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
              <span>Carregando dossiê completo...</span>
            </div>
          ) : !person ? (
            <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
              <p className="text-lg font-medium">Perfil não encontrado.</p>
              <p className="text-sm">Verifique se o candidato ou colaborador possui registro no sistema.</p>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-3">
              {/* Coluna Esquerda: Cartão Resumo */}
              <div className="space-y-6 lg:col-span-1 border-r pr-2">
                <div className="p-5 rounded-xl bg-card border shadow-xs space-y-4">
                  <h3 className="text-2xl font-bold text-primary tracking-tight">
                    {person.full_name || person.name || [person.first_name, person.last_name].filter(Boolean).join(" ")}
                  </h3>
                  <div className="space-y-2.5 text-sm text-muted-foreground">
                    {(person.role_interest || person.role) && (
                      <div className="flex items-center gap-2.5"><Briefcase className="h-4 w-4 text-primary shrink-0" /> <span className="font-medium text-foreground">{person.role_interest || person.role}</span></div>
                    )}
                    {(person.city || person.state || person.workplace) && (
                      <div className="flex items-center gap-2.5"><MapPin className="h-4 w-4 text-primary shrink-0" /> {[person.city, person.state, person.workplace].filter(Boolean).join(", ")}</div>
                    )}
                    {(person.email || person.email_corporate || person.email_personal) && (
                      <div className="flex items-center gap-2.5 break-all"><Mail className="h-4 w-4 text-primary shrink-0" /> {person.email || person.email_corporate || person.email_personal}</div>
                    )}
                    {person.phone && (
                      <div className="flex items-center gap-2.5"><Phone className="h-4 w-4 text-primary shrink-0" /> {person.phone}</div>
                    )}
                  </div>
                  {person.resume_url && (
                    <Button variant="outline" size="sm" className="mt-4 w-full border-primary/20 hover:bg-primary/5 text-primary font-medium" onClick={openResume} disabled={openingResume}>
                      {openingResume ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Paperclip className="h-4 w-4 mr-2" />}
                      Ver Currículo Anexo (PDF)
                    </Button>
                  )}
                </div>

                <div className="space-y-3 p-4 rounded-xl border bg-muted/20">
                  <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" /> Tags e Competências
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {person.search_tags?.map((tag: string) => (
                      <span key={tag} className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">{tag}</span>
                    ))}
                    {person.behavioral_tags?.map((tag: string) => (
                      <span key={tag} className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{tag}</span>
                    ))}
                    {(!person.search_tags?.length && !person.behavioral_tags?.length) && (
                      <span className="text-xs text-muted-foreground">Nenhuma tag ou expectativa cadastrada</span>
                    )}
                  </div>
                </div>

                {candidateId && !person.search_tags?.includes("Central do Candidato") && !person.search_tags?.includes("Aprovado na Entrevista") && (
                  <Button 
                    variant="secondary" 
                    className="w-full shadow-xs" 
                    onClick={async () => {
                      const supabase = createClient();
                      const newTags = [...(person.search_tags || []), "Central do Candidato"];
                      await supabase.from("candidates").update({ search_tags: newTags }).eq("id", candidateId);
                      setPerson({ ...person, search_tags: newTags });
                      alert("Candidato movido para Em Processo na Central do Candidato!");
                    }}
                  >
                    Mover p/ Central do Candidato
                  </Button>
                )}
              </div>

              {/* Coluna Direita: Abas e Detalhamento */}
              <div className="space-y-6 lg:col-span-2">
                {/* Seletor de Abas */}
                <div className="flex border-b space-x-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("curriculum")}
                    className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                      activeTab === "curriculum"
                        ? "border-primary text-primary font-semibold"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                    Currículo & Entrevistas
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("behavioral")}
                    className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                      activeTab === "behavioral"
                        ? "border-primary text-primary font-semibold"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Sparkles className="h-4 w-4" />
                    Teste Comportamental (Big Five)
                    {results.length > 0 && <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{results.length}</span>}
                  </button>
                </div>

                {/* Conteúdo da Aba: Currículo & Entrevistas */}
                {activeTab === "curriculum" && (
                  <div className="space-y-8 animate-in fade-in duration-200">
                    {/* Dados Pessoais & Contato */}
                    <div className="space-y-4">
                      <h3 className="text-base font-bold flex items-center gap-2 text-foreground border-b pb-2">
                        <Contact className="h-5 w-5 text-primary" />
                        Dados Pessoais & Contato
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 text-sm">
                        {person.cpf && (
                          <div className="p-3 rounded-xl border bg-card shadow-2xs">
                            <span className="text-xs text-muted-foreground block">CPF</span>
                            <span className="font-semibold">{person.cpf}</span>
                          </div>
                        )}
                        {person.birth_date && (
                          <div className="p-3 rounded-xl border bg-card shadow-2xs">
                            <span className="text-xs text-muted-foreground block">Data de Nascimento</span>
                            <span className="font-semibold">{new Date(person.birth_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                          </div>
                        )}
                        {person.birthplace && (
                          <div className="p-3 rounded-xl border bg-card shadow-2xs">
                            <span className="text-xs text-muted-foreground block">Naturalidade</span>
                            <span className="font-semibold">{person.birthplace}</span>
                          </div>
                        )}
                        {person.marital_status && (
                          <div className="p-3 rounded-xl border bg-card shadow-2xs">
                            <span className="text-xs text-muted-foreground block">Estado Civil</span>
                            <span className="font-semibold">{person.marital_status}</span>
                          </div>
                        )}
                        {person.address && (
                          <div className="p-3 rounded-xl border bg-card shadow-2xs md:col-span-2">
                            <span className="text-xs text-muted-foreground block">Endereço</span>
                            <span className="font-semibold">{person.address}</span>
                          </div>
                        )}
                        {person.secondary_phone && (
                          <div className="p-3 rounded-xl border bg-card shadow-2xs">
                            <span className="text-xs text-muted-foreground block">Telefone Secundário</span>
                            <span className="font-semibold">{person.secondary_phone}</span>
                          </div>
                        )}
                        {person.secondary_email && (
                          <div className="p-3 rounded-xl border bg-card shadow-2xs">
                            <span className="text-xs text-muted-foreground block">E-mail Secundário</span>
                            <span className="font-semibold break-all">{person.secondary_email}</span>
                          </div>
                        )}
                        {(person.emergency_contact_name || person.emergency_contact_phone) && (
                          <div className="p-3 rounded-xl border bg-card shadow-2xs md:col-span-2">
                            <span className="text-xs text-muted-foreground block">Contato de Emergência</span>
                            <span className="font-semibold">
                              {person.emergency_contact_name} {person.emergency_contact_phone && `- ${person.emergency_contact_phone}`}
                            </span>
                          </div>
                        )}
                        {person.has_cnh && (
                          <div className="p-3 rounded-xl border bg-card shadow-2xs">
                            <span className="text-xs text-muted-foreground block">CNH</span>
                            <span className="font-semibold">Sim {person.cnh_categories && `(Categoria ${person.cnh_categories})`}</span>
                          </div>
                        )}
                      </div>
                      {person.personal_info && (
                        <div className="mt-2 text-sm p-3 rounded-xl border bg-muted/20">
                          <span className="text-xs font-bold block mb-1">Mais Detalhes Pessoais:</span>
                          <p className="text-muted-foreground whitespace-pre-line">{person.personal_info}</p>
                        </div>
                      )}
                    </div>

                    {/* Informações Adicionais */}
                    <div className="space-y-4">
                      <h3 className="text-base font-bold flex items-center gap-2 text-foreground border-b pb-2">
                        <Info className="h-5 w-5 text-primary" />
                        Informações Adicionais
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 text-sm">
                        {person.salary_expectation && (
                          <div className="p-3 rounded-xl border bg-card shadow-2xs flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-primary shrink-0" />
                            <div>
                              <span className="text-xs text-muted-foreground block">Pretensão Salarial</span>
                              <span className="font-semibold">{person.salary_expectation}</span>
                            </div>
                          </div>
                        )}
                        {person.has_dependents && (
                          <div className="p-3 rounded-xl border bg-card shadow-2xs">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-primary shrink-0" />
                              <div>
                                <span className="text-xs text-muted-foreground block">Dependentes</span>
                                <span className="font-semibold">Sim ({person.dependents_count || 'Não informado'})</span>
                              </div>
                            </div>
                            {person.dependents_notes && (
                              <p className="text-[11px] text-muted-foreground mt-1 bg-muted/30 p-1.5 rounded">{person.dependents_notes}</p>
                            )}
                          </div>
                        )}
                        {(person.uniform_size || person.boot_size) && (
                          <div className="p-3 rounded-xl border bg-card shadow-2xs">
                            <span className="text-xs text-muted-foreground block">Tamanhos (EPIs)</span>
                            <span className="font-semibold">
                              {person.uniform_size && `Uniforme: ${person.uniform_size}`}
                              {person.uniform_size && person.boot_size && ' / '}
                              {person.boot_size && `Botina: ${person.boot_size}`}
                            </span>
                          </div>
                        )}
                      </div>
                      {person.additional_info && (
                        <div className="mt-2 text-sm p-3 rounded-xl border bg-muted/20">
                          <span className="text-xs font-bold block mb-1">Outras Informações Adicionais:</span>
                          <p className="text-muted-foreground whitespace-pre-line">{person.additional_info}</p>
                        </div>
                      )}
                    </div>

                    {/* Diversidade */}
                    {(person.gender_identity || person.sexual_orientation || person.race_declaration || person.diversity_info) && (
                      <details className="group space-y-4 rounded-xl border bg-card shadow-2xs p-4 [&_summary::-webkit-details-marker]:hidden">
                        <summary className="flex cursor-pointer items-center justify-between font-bold text-foreground">
                          <div className="flex items-center gap-2">
                            <Heart className="h-5 w-5 text-primary" />
                            Diversidade
                          </div>
                          <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded-full group-open:hidden">
                            Mostrar dados sensíveis
                          </span>
                        </summary>
                        <div className="pt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 text-sm border-t mt-3">
                          {person.gender_identity && (
                            <div className="p-3 rounded-lg border bg-muted/20">
                              <span className="text-xs text-muted-foreground block">Autodeclaração de Gênero</span>
                              <span className="font-semibold">{person.gender_identity}</span>
                            </div>
                          )}
                          {person.sexual_orientation && (
                            <div className="p-3 rounded-lg border bg-muted/20">
                              <span className="text-xs text-muted-foreground block">Orientação Sexual</span>
                              <span className="font-semibold">{person.sexual_orientation}</span>
                            </div>
                          )}
                          {person.race_declaration && (
                            <div className="p-3 rounded-lg border bg-muted/20">
                              <span className="text-xs text-muted-foreground block">Autodeclaração de Raça</span>
                              <span className="font-semibold">{person.race_declaration}</span>
                            </div>
                          )}
                        </div>
                        {person.diversity_info && (
                          <div className="mt-2 text-sm p-3 rounded-lg border bg-muted/20">
                            <span className="text-xs font-bold block mb-1">Informações Adicionais (Diversidade):</span>
                            <p className="text-muted-foreground whitespace-pre-line">{person.diversity_info}</p>
                          </div>
                        )}
                      </details>
                    )}

                    {/* Formação Acadêmica */}
                    <div className="space-y-4">
                      <h3 className="text-base font-bold flex items-center gap-2 text-foreground border-b pb-2">
                        <GraduationCap className="h-5 w-5 text-primary" />
                        Formação Acadêmica
                      </h3>
                      {educations.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic pl-2">Nenhum registro acadêmico detalhado.</p>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {educations.map((edu, i) => (
                            <div key={i} className="p-4 rounded-xl border bg-card text-sm space-y-1 shadow-2xs">
                              <p className="font-bold text-foreground">{edu.degree || edu.course || "Formação Acadêmica"}</p>
                              <p className="text-xs text-muted-foreground font-medium">{edu.institution || "Instituição não informada"}</p>
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t mt-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-muted text-foreground font-medium">{edu.status || "Concluído"}</span>
                                <span>{[edu.start_date, edu.end_date].filter(Boolean).join(" até ")}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Histórico Profissional */}
                    <div className="space-y-4">
                      <h3 className="text-base font-bold flex items-center gap-2 text-foreground border-b pb-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        Histórico Profissional
                      </h3>
                      {experiences.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic pl-2">Nenhuma experiência profissional estruturada registrada.</p>
                      ) : (
                        <div className="space-y-3">
                          {experiences.map((exp, i) => (
                            <div key={i} className="p-4 rounded-xl border bg-card text-sm space-y-2 shadow-2xs">
                              <div className="flex items-center justify-between">
                                <p className="font-bold text-foreground text-base">{exp.role || "Cargo / Função"}</p>
                                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${exp.current ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                                  {exp.current ? "Atual" : [exp.start_date, exp.end_date].filter(Boolean).join(" - ")}
                                </span>
                              </div>
                              <p className="text-xs font-semibold text-primary">{exp.company || "Empresa"}</p>
                              {exp.activities && (
                                <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-md border border-muted/50">{exp.activities}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Histórico de Avaliações / Entrevistas */}
                    <div className="space-y-4">
                      <h3 className="text-base font-bold flex items-center gap-2 text-foreground border-b pb-2">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        Avaliações de Entrevistas & Parecer RH
                      </h3>
                      {interviews.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic pl-2">Nenhuma entrevista ou avaliação técnica registrada para este colaborador/candidato.</p>
                      ) : (
                        <div className="space-y-4">
                          {interviews.map((int) => {
                            const ass = int.assessment || {};
                            return (
                              <div key={int.id} className="p-5 rounded-xl border bg-card shadow-xs space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                                  <div>
                                    <p className="font-bold text-base text-foreground">{int.role || "Cargo Alvo"}</p>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                      <Calendar className="h-3 w-3" /> Data: {int.interview_date ? new Date(int.interview_date + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/I'} — Entrevistado por: <span className="font-medium text-foreground">{int.evaluator || "RH / Gestão de Pessoas"}</span>
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {ass.selection_stage && (
                                      <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
                                        Fase: {ass.selection_stage}
                                      </span>
                                    )}
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                      int.result === "Aprovado" || int.result === "Contratado" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" :
                                      int.result === "Reprovado" ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300" :
                                      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                    }`}>
                                      {int.result || int.status}
                                    </span>
                                  </div>
                                </div>

                                {/* Notas / Pontuações */}
                                {(ass.communication_rating || ass.tech_knowledge_rating || ass.culture_fit) && (
                                  <div className="grid grid-cols-3 gap-3 bg-muted/30 p-3 rounded-lg border text-center text-xs">
                                    <div>
                                      <span className="text-muted-foreground block">Comunicação</span>
                                      <span className="font-bold text-foreground text-sm">{ass.communication_rating || "N/A"} / 5</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block">Conhecimento Técnico</span>
                                      <span className="font-bold text-foreground text-sm">{ass.tech_knowledge_rating || "N/A"} / 5</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block">Fit Cultural (Alinhamento)</span>
                                      <span className="font-bold text-primary text-sm">{ass.culture_fit || "N/A"}</span>
                                    </div>
                                  </div>
                                )}

                                {/* Pontos Fortes / A Melhorar */}
                                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                                  {ass.strengths && (
                                    <div className="p-3 rounded-lg border bg-emerald-500/5 border-emerald-500/20">
                                      <p className="font-bold text-emerald-700 dark:text-emerald-400 mb-1">Pontos Fortes (Destaques):</p>
                                      <p className="text-muted-foreground whitespace-pre-line leading-relaxed">{ass.strengths}</p>
                                    </div>
                                  )}
                                  {ass.improvement_points && (
                                    <div className="p-3 rounded-lg border bg-amber-500/5 border-amber-500/20">
                                      <p className="font-bold text-amber-700 dark:text-amber-400 mb-1">Pontos a Desenvolver / Observações:</p>
                                      <p className="text-muted-foreground whitespace-pre-line leading-relaxed">{ass.improvement_points}</p>
                                    </div>
                                  )}
                                </div>

                                {ass.final_observations && (
                                  <div className="text-xs bg-muted/20 p-3 rounded-lg border">
                                    <p className="font-bold mb-1">Parecer Final do Entrevistador:</p>
                                    <p className="text-muted-foreground whitespace-pre-line">{ass.final_observations}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Conteúdo da Aba: Mapeamento Big Five */}
                {activeTab === "behavioral" && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h3 className="text-base font-bold text-foreground">Histórico Mapeamento Big Five (BFI-44)</h3>
                      <span className="text-xs font-semibold text-muted-foreground px-2 py-1 bg-muted rounded-md">{results.length} avaliação(ões)</span>
                    </div>

                    {results.length === 0 ? (
                      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground space-y-2">
                        <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/40" />
                        <p className="font-medium text-foreground">Nenhum mapeamento de personalidade concluído</p>
                        <p className="text-xs">Solicite ao candidato o envio do teste BFI-44 via Kanban de Vagas ou Central do Candidato.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {results.map((res, idx) => (
                          <div key={res.id} className="relative rounded-xl border bg-card p-5 shadow-sm space-y-5">
                            {idx === 0 && <span className="absolute -top-3 right-4 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-sm">Mais Recente</span>}
                            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground pb-2 border-b">
                              <Calendar className="h-4 w-4 text-primary" /> Realizado em: {new Date(res.created_at).toLocaleDateString('pt-BR')}
                            </div>
                            
                            <div className="space-y-4">
                              <BigFiveBar label="Abertura a Experiências (O)" score={res.openness_score} color="bg-blue-500" />
                              <BigFiveBar label="Conscienciosidade (C)" score={res.conscientiousness_score} color="bg-emerald-500" />
                              <BigFiveBar label="Extroversão (E)" score={res.extraversion_score} color="bg-amber-500" />
                              <BigFiveBar label="Amabilidade (A)" score={res.agreeableness_score} color="bg-purple-500" />
                              <BigFiveBar label="Neuroticismo (N)" score={res.neuroticism_score} color="bg-rose-500" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-6 py-3.5 bg-muted/20">
          <Button variant="outline" onClick={onClose} className="min-w-24 font-medium">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}

function BigFiveBar({ label, score, color }: { label: string; score: number | null; color: string }) {
  const percentage = score ? Math.min(100, Math.max(0, (score / 5) * 100)) : 0;
  
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="font-bold text-foreground">{label}</span>
        <span className="font-bold text-primary">{score ? score.toFixed(1) : "N/A"} / 5.0</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        {score !== null && (
          <div 
            className={`h-full rounded-full ${color} transition-all duration-700`} 
            style={{ width: `${percentage}%` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/80 font-medium">
        <span>Baixo (1)</span>
        <span>Médio (3)</span>
        <span>Alto (5)</span>
      </div>
    </div>
  );
}
