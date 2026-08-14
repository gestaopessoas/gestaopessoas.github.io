"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  X, Briefcase, MapPin, Mail, Phone, Calendar, Paperclip, Loader2, FileText, 
  Sparkles, GraduationCap, Building2, Award, CheckCircle2, User, Contact, 
  Info, Heart, DollarSign, Users, ChevronRight, Edit2, Save, History, FileCheck, FileUp
} from "lucide-react";
import { CandidateAssessmentTab } from "./CandidateAssessmentTab";
import * as pdfjsLib from "pdfjs-dist";
import { itemsToText, parseSolidesResume } from "@/lib/resumeParser";

if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

type BigFiveResult = {
  id: string;
  created_at: string;
  openness_score: number | null;
  conscientiousness_score: number | null;
  extraversion_score: number | null;
  agreeableness_score: number | null;
  neuroticism_score: number | null;
};

type ProfilePerson = {
  id?: string;
  full_name?: string | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  email_personal?: string | null;
  email_corporate?: string | null;
  phone?: string | null;
  secondary_phone?: string | null;
  secondary_email?: string | null;
  role?: string | null;
  role_interest?: string | null;
  city?: string | null;
  state?: string | null;
  workplace?: string | null;
  address?: string | null;
  birth_date?: string | null;
  birthplace?: string | null;
  cpf?: string | null;
  marital_status?: string | null;
  gender?: string | null;
  uniform_size?: string | null;
  boot_size?: string | null;
  salary_expectation?: string | null;
  languages?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  gender_identity?: string | null;
  sexual_orientation?: string | null;
  race_declaration?: string | null;
  dependents_notes?: string | null;
  dependents_count?: number | string | null;
  has_cnh?: boolean | null;
  has_dependents?: boolean | null;
  cnh_categories?: string[] | string | null;
  search_tags?: string[] | null;
  behavioral_tags?: string[] | null;
  resume_url?: string | null;
  isFromInterview?: boolean;
};

type ProfileEducation = {
  id?: string;
  degree?: string | null;
  course?: string | null;
  institution?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

type ProfileExperience = {
  id?: string;
  role?: string | null;
  company?: string | null;
  current?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  activities?: string | null;
};

type AssessmentAcademic = ProfileEducation & { start_year?: string | null; end_year?: string | null };
type AssessmentExperience = ProfileExperience;

type CandidateInterview = {
  id: string;
  candidate_id: string;
  stage: string;
  workplace_name?: string | null;
  interviewer_name?: string | null;
  created_at: string;
  notes?: string | null;
  rejection_reason?: string | null;
};

type ProfileInterview = {
  id: string;
  role?: string | null;
  status?: string | null;
  result?: string | null;
  evaluator?: string | null;
  interview_date?: string | null;
  assessment?: {
    academic_list?: AssessmentAcademic[];
    experience_list?: AssessmentExperience[];
    worksite?: string | null;
    selection_stage?: string | null;
    tech_knowledge_rating?: number | string | null;
    communication_rating?: number | string | null;
    culture_fit?: string | null;
    strengths?: string | null;
    improvement_points?: string | null;
    final_observations?: string | null;
  } | null;
};

type CandidateProfileModalProps = {
  candidateId?: string | null;
  employeeId?: string | null;
  interviewId?: string | null;
  email?: string | null;
  candidateName?: string | null;
  initialTab?: "curriculum" | "assessment" | "behavioral" | "history";
  onClose: () => void;
  isEditable?: boolean;
  defaultEditMode?: boolean;
  initialData?: Partial<ProfilePerson>;
  initialAssessmentData?: any;
  onSave?: (data: ProfilePerson, assessmentData: any) => Promise<void>;
};

export function CandidateProfileModal({
  candidateId,
  employeeId,
  interviewId,
  email,
  candidateName,
  initialTab = "curriculum",
  onClose,
  isEditable = false,
  defaultEditMode = false,
  initialData,
  initialAssessmentData,
  onSave
}: CandidateProfileModalProps) {
  const [activeTab, setActiveTab] = useState<"curriculum" | "assessment" | "behavioral" | "history">(initialTab);
  const [person, setPerson] = useState<ProfilePerson | null>(initialData ? (initialData as ProfilePerson) : null);
  const [formData, setFormData] = useState<ProfilePerson>(initialData || {});
  const [assessmentData, setAssessmentData] = useState<any>(initialAssessmentData || {});
  const [isEditing, setIsEditing] = useState(defaultEditMode);
  const [isSaving, setIsSaving] = useState(false);
  const [isParsingCv, setIsParsingCv] = useState(false);

  const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingCv(true);
    let text = "";

    try {
      if (file.type === "application/pdf") {
        const reader = new FileReader();
        text = await new Promise<string>((resolve, reject) => {
          reader.onload = async () => {
            try {
              const typedarray = new Uint8Array(reader.result as ArrayBuffer);
              const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
              let extracted = "";
              for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                extracted += itemsToText(content.items) + "\n";
              }
              resolve(extracted);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });
      } else if (file.type === "text/plain") {
        const reader = new FileReader();
        text = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });
      }

      if (!text) throw new Error("Texto vazio");

      let parsed = null;
      try {
        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        if (!apiKey) throw new Error("Chave não configurada");

        const prompt = `Extraia os seguintes dados do currículo abaixo e retorne APENAS um JSON válido, sem crases, sem markdown, no formato:
{ "name": "Nome", "email": "Email", "phone": "Telefone", "role": "Cargo", "city": "Cidade", "state": "Estado" }
Texto:
${text.substring(0, 5000)}`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1 }
          })
        });

        if (!res.ok) throw new Error("Erro na API Gemini");
        const json = await res.json();
        let rawStr = json.candidates[0].content.parts[0].text;
        rawStr = rawStr.replace(/```json\n?|\n?```/g, "").trim();
        parsed = JSON.parse(rawStr);
        
      } catch (aiError) {
        console.warn("Erro na IA, usando analisador local", aiError);
        parsed = parseSolidesResume(text);
      }

      if (parsed) {
        setFormData(prev => ({
          ...prev,
          full_name: parsed.name || prev.full_name,
          email: parsed.email || prev.email,
          phone: parsed.phone || prev.phone,
          role: parsed.role || prev.role,
          city: parsed.city || parsed.location?.split("-")[0]?.trim() || prev.city,
          state: parsed.state || parsed.location?.split("-")[1]?.trim() || prev.state,
        }));
      }

    } catch (err) {
      alert("Erro ao ler o currículo.");
    } finally {
      setIsParsingCv(false);
      e.target.value = '';
    }
  };
  
  const [results, setResults] = useState<BigFiveResult[]>([]);
  const [interviews, setInterviews] = useState<ProfileInterview[]>([]);
  const [candidateInterviews, setCandidateInterviews] = useState<CandidateInterview[]>([]);
  const [educations, setEducations] = useState<ProfileEducation[]>([]);
  const [experiences, setExperiences] = useState<ProfileExperience[]>([]);
  const [loading, setLoading] = useState(!initialData);
  const [openingResume, setOpeningResume] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const openResume = async () => {
    if (!person?.resume_url) return;
    setOpeningResume(true);
    const supabase = createClient();
    
    // Marca inscrições novas como lidas
    if (person.id) {
      await supabase
        .from("job_applications")
        .update({ status: "Currículo Visualizado" })
        .eq("candidate_id", person.id)
        .eq("status", "Nova Aplicação");
    }

    const { data, error } = await supabase.storage.from("resumes").createSignedUrl(person.resume_url, 60);
    setOpeningResume(false);
    if (error || !data) {
      alert("Não foi possível abrir o currículo. Tente novamente.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleChange = (field: keyof ProfilePerson, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAssessmentChange = (field: string, value: any) => {
    setAssessmentData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (onSave) {
      setIsSaving(true);
      await onSave(formData, assessmentData);
      setPerson({ ...person, ...formData });
      setIsSaving(false);
      setIsEditing(false);
    }
  };

  // Fecha com ESC
  useEffect(() => {
    if (!candidateId && !employeeId && !interviewId && !email && !candidateName && !initialData) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [candidateId, employeeId, interviewId, email, candidateName, initialData, onClose]);

  // Foco
  useEffect(() => {
    if (!candidateId && !employeeId && !interviewId && !email && !candidateName && !initialData) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(t);
      restoreRef.current?.focus?.();
    };
  }, [candidateId, employeeId, interviewId, email, candidateName, initialData]);

  useEffect(() => {
    if (initialData) return;
    if (!candidateId && !employeeId && !interviewId && !email && !candidateName) return;
    
    let active = true;
    const loadProfile = async () => {
      setLoading(true);
      const supabase = createClient();
      
      let personData: ProfilePerson | null = null;
      let resultsData: BigFiveResult[] = [];
      let educationsData: ProfileEducation[] = [];
      let interviewsData: ProfileInterview[] = [];
      let candidateInterviewsData: CandidateInterview[] = [];

      // 1. Resolver dados da Pessoa
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

      // Se ainda não achou, buscar em interviews
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

      // 3. Buscar histórico de etapas
      if (targetCandId) {
        const { data } = await supabase.from("candidate_interviews").select("*").eq("candidate_id", targetCandId).order("created_at", { ascending: false });
        if (data) candidateInterviewsData = data;
      }

      // 4. Buscar formações
      if (targetCandId) {
        const { data } = await supabase.from("candidate_educations").select("*").eq("candidate_id", targetCandId).order("start_date", { ascending: false });
        if (data) educationsData = data;
      }

      // 5. Buscar entrevistas
      if (personEmail || personName || interviewId) {
        let intQuery = supabase.from("interviews").select("*").order("interview_date", { ascending: false });
        if (interviewId) {
          intQuery = intQuery.eq("id", interviewId);
        } else if (personEmail && personName) {
          intQuery = intQuery.or(`email.ilike."${personEmail}",candidate_name.ilike."${personName}"`);
        } else if (personEmail) {
          intQuery = intQuery.ilike("email", personEmail);
        } else if (personName) {
          intQuery = intQuery.ilike("candidate_name", personName);
        }
        const { data } = await intQuery;
        if (data) interviewsData = data;
      }

      // Extrair formações e experiências
      const extractedEdu: ProfileEducation[] = [...educationsData];
      const extractedExp: ProfileExperience[] = [];

      interviewsData.forEach((int) => {
        if (int.assessment) {
          const assess = int.assessment as any;
          if (Array.isArray(assess.academic_list)) {
            assess.academic_list.forEach((ac: any) => {
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
          if (Array.isArray(assess.experience_list)) {
            assess.experience_list.forEach((ex: any) => {
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
      if (interviewsData.length > 0 && interviewsData[0].assessment) {
        setAssessmentData(interviewsData[0].assessment);
      } else {
        setAssessmentData({});
      }
      setFormData(personData || {});
      setResults(resultsData);
      setEducations(extractedEdu);
      setExperiences(extractedExp);
      setInterviews(interviewsData);
      setCandidateInterviews(candidateInterviewsData);
      setLoading(false);
    };

    loadProfile();
    return () => { active = false; };
  }, [candidateId, employeeId, interviewId, email, candidateName, initialData]);

  if (!candidateId && !employeeId && !interviewId && !email && !candidateName && !initialData) return null;

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
        className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl border outline-none animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/30">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Perfil do Colaborador / Candidato</h2>
              <p className="text-xs text-muted-foreground">Visão unificada de informações e histórico</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {isEditable && !isEditing && (
              <Button onClick={() => setIsEditing(true)} variant="outline" size="sm" className="gap-2">
                <Edit2 className="h-4 w-4" /> Editar Perfil
              </Button>
            )}
            {isEditing && (
              <>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium transition-colors bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 h-9 px-3 rounded-md">
                  {isParsingCv ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                  Ler Currículo
                  <input type="file" accept=".pdf,.txt" className="hidden" onChange={handleCVUpload} disabled={isParsingCv} />
                </label>
                <Button onClick={handleSave} disabled={isSaving} size="sm" className="gap-2">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content (Sidebar Layout) */}
        <div className="flex flex-1 overflow-hidden">
          {loading ? (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
              <span>Carregando dossiê completo...</span>
            </div>
          ) : !person ? (
            <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground">
              <p className="text-lg font-medium">Perfil não encontrado.</p>
              <p className="text-sm">Verifique se o candidato ou colaborador possui registro no sistema.</p>
            </div>
          ) : (
            <>
              {/* Left Sidebar */}
              <div className="w-80 border-r bg-muted/10 flex flex-col h-full overflow-y-auto">
                {/* Profile Card */}
                <div className="p-6 border-b bg-card">
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-primary tracking-tight leading-tight">
                      {isEditing ? (
                        <Input 
                          value={formData.full_name || formData.name || ""} 
                          onChange={(e) => handleChange(formData.full_name !== undefined ? 'full_name' : 'name', e.target.value)}
                          placeholder="Nome completo"
                        />
                      ) : (
                        formData.full_name || formData.name || [formData.first_name, formData.last_name].filter(Boolean).join(" ")
                      )}
                    </h3>
                    <div className="space-y-2.5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2.5">
                        <Briefcase className="h-4 w-4 text-primary shrink-0" />
                        {isEditing ? (
                          <Input 
                            value={formData.role_interest || formData.role || ""} 
                            onChange={(e) => handleChange(formData.role_interest !== undefined ? 'role_interest' : 'role', e.target.value)}
                            placeholder="Cargo"
                            className="h-7 text-xs"
                          />
                        ) : (
                          <span className="font-medium text-foreground">{formData.role_interest || formData.role || "Cargo não informado"}</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2.5 break-all">
                        <Mail className="h-4 w-4 text-primary shrink-0" />
                        {isEditing ? (
                          <Input 
                            value={formData.email || formData.email_personal || ""} 
                            onChange={(e) => handleChange('email', e.target.value)}
                            placeholder="E-mail"
                            className="h-7 text-xs"
                          />
                        ) : (
                          formData.email || formData.email_corporate || formData.email_personal || "Sem e-mail"
                        )}
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Phone className="h-4 w-4 text-primary shrink-0" />
                        {isEditing ? (
                          <Input 
                            value={formData.phone || ""} 
                            onChange={(e) => handleChange('phone', e.target.value)}
                            placeholder="Telefone"
                            className="h-7 text-xs"
                          />
                        ) : (
                          formData.phone || "Sem telefone"
                        )}
                      </div>
                    </div>
                    {person.resume_url && !isEditing && (
                      <Button variant="outline" size="sm" className="mt-4 w-full border-primary/20 hover:bg-primary/5 text-primary font-medium" onClick={openResume} disabled={openingResume}>
                        {openingResume ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Paperclip className="h-4 w-4 mr-2" />}
                        Ver Currículo PDF
                      </Button>
                    )}
                  </div>
                </div>

                {/* Vertical Navigation */}
                <div className="p-4 space-y-1">
                  <button
                    onClick={() => setActiveTab("curriculum")}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === "curriculum" ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4" />
                      Currículo & Pessoal
                    </div>
                    {activeTab === "curriculum" && <ChevronRight className="h-4 w-4 opacity-50" />}
                  </button>
                  <button
                    onClick={() => setActiveTab("assessment")}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === "assessment" ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
                  >
                    <div className="flex items-center gap-3">
                      <FileCheck className="h-4 w-4" />
                      Parecer / Avaliação
                    </div>
                    {activeTab === "assessment" && <ChevronRight className="h-4 w-4 opacity-50" />}
                  </button>
                  <button
                    onClick={() => setActiveTab("behavioral")}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === "behavioral" ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
                  >
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-4 w-4" />
                      Teste Comportamental
                      {!isEditing && results.length > 0 && (
                        <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] ${activeTab === "behavioral" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                          {results.length}
                        </span>
                      )}
                    </div>
                    {activeTab === "behavioral" && <ChevronRight className="h-4 w-4 opacity-50" />}
                  </button>
                  <button
                    onClick={() => setActiveTab("history")}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === "history" ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
                  >
                    <div className="flex items-center gap-3">
                      <History className="h-4 w-4" />
                      Histórico
                    </div>
                    {activeTab === "history" && <ChevronRight className="h-4 w-4 opacity-50" />}
                  </button>
                </div>
              </div>

              {/* Right Content Area */}
              <div className="flex-1 overflow-y-auto p-8 bg-muted/5">
                {activeTab === "curriculum" && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <h2 className="text-2xl font-bold mb-6">Currículo & Dados Pessoais</h2>
                    
                    {/* Dados Pessoais & Contato (Accordion) */}
                    <details open className="group rounded-xl border bg-card shadow-sm [&_summary::-webkit-details-marker]:hidden">
                      <summary className="flex cursor-pointer items-center justify-between font-bold text-foreground p-5 border-b">
                        <div className="flex items-center gap-2">
                          <Contact className="h-5 w-5 text-primary" />
                          Dados Pessoais & Contato
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-90" />
                      </summary>
                      <div className="p-5 grid gap-4 sm:grid-cols-2 md:grid-cols-3 text-sm">
                        <div className="space-y-1.5">
                          <span className="text-xs text-muted-foreground block font-medium">CPF</span>
                          {isEditing ? (
                            <Input value={formData.cpf || ""} onChange={(e) => handleChange('cpf', e.target.value)} />
                          ) : (
                            <span className="font-semibold">{formData.cpf || "-"}</span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-xs text-muted-foreground block font-medium">Data de Nascimento</span>
                          {isEditing ? (
                            <Input type="date" value={formData.birth_date || ""} onChange={(e) => handleChange('birth_date', e.target.value)} />
                          ) : (
                            <span className="font-semibold">{formData.birth_date ? new Date(formData.birth_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : "-"}</span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-xs text-muted-foreground block font-medium">Naturalidade</span>
                          {isEditing ? (
                            <Input value={formData.birthplace || ""} onChange={(e) => handleChange('birthplace', e.target.value)} />
                          ) : (
                            <span className="font-semibold">{formData.birthplace || "-"}</span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-xs text-muted-foreground block font-medium">Estado Civil</span>
                          {isEditing ? (
                            <select 
                              value={formData.marital_status || ""} 
                              onChange={(e) => handleChange('marital_status', e.target.value)}
                              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="">Selecione...</option>
                              <option value="Solteiro(a)">Solteiro(a)</option>
                              <option value="Casado(a)">Casado(a)</option>
                              <option value="Divorciado(a)">Divorciado(a)</option>
                              <option value="Viúvo(a)">Viúvo(a)</option>
                              <option value="União Estável">União Estável</option>
                            </select>
                          ) : (
                            <span className="font-semibold">{formData.marital_status || "-"}</span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-xs text-muted-foreground block font-medium">Gênero</span>
                          {isEditing ? (
                            <Input value={formData.gender || ""} onChange={(e) => handleChange('gender', e.target.value)} />
                          ) : (
                            <span className="font-semibold">{formData.gender || "-"}</span>
                          )}
                        </div>
                        <div className="space-y-1.5 md:col-span-3">
                          <span className="text-xs text-muted-foreground block font-medium">Endereço (Cidade, UF, Logradouro)</span>
                          {isEditing ? (
                            <div className="grid grid-cols-3 gap-2">
                              <Input placeholder="Cidade" value={formData.city || ""} onChange={(e) => handleChange('city', e.target.value)} />
                              <Input placeholder="Estado" value={formData.state || ""} onChange={(e) => handleChange('state', e.target.value)} />
                              <Input placeholder="Endereço Completo" value={formData.address || ""} onChange={(e) => handleChange('address', e.target.value)} className="col-span-3" />
                            </div>
                          ) : (
                            <span className="font-semibold">{[formData.city, formData.state, formData.address].filter(Boolean).join(", ") || "-"}</span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-xs text-muted-foreground block font-medium">Telefone Secundário</span>
                          {isEditing ? (
                            <Input value={formData.secondary_phone || ""} onChange={(e) => handleChange('secondary_phone', e.target.value)} />
                          ) : (
                            <span className="font-semibold">{formData.secondary_phone || "-"}</span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-xs text-muted-foreground block font-medium">E-mail Secundário</span>
                          {isEditing ? (
                            <Input type="email" value={formData.secondary_email || ""} onChange={(e) => handleChange('secondary_email', e.target.value)} />
                          ) : (
                            <span className="font-semibold break-all">{formData.secondary_email || "-"}</span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-xs text-muted-foreground block font-medium">Possui CNH?</span>
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <select 
                                value={formData.has_cnh ? "true" : "false"} 
                                onChange={(e) => handleChange('has_cnh', e.target.value === "true")}
                                className="flex h-10 w-24 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                              >
                                <option value="false">Não</option>
                                <option value="true">Sim</option>
                              </select>
                              {formData.has_cnh && (
                                <Input placeholder="Categoria(s)" value={Array.isArray(formData.cnh_categories) ? formData.cnh_categories.join(", ") : formData.cnh_categories || ""} onChange={(e) => handleChange('cnh_categories', e.target.value)} className="flex-1" />
                              )}
                            </div>
                          ) : (
                            <span className="font-semibold">{formData.has_cnh ? `Sim ${formData.cnh_categories ? `(Cat: ${formData.cnh_categories})` : ''}` : "Não"}</span>
                          )}
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <span className="text-xs text-muted-foreground block font-medium">Contato de Emergência</span>
                          {isEditing ? (
                            <div className="flex gap-2">
                              <Input placeholder="Nome" value={formData.emergency_contact_name || ""} onChange={(e) => handleChange('emergency_contact_name', e.target.value)} />
                              <Input placeholder="Telefone" value={formData.emergency_contact_phone || ""} onChange={(e) => handleChange('emergency_contact_phone', e.target.value)} />
                            </div>
                          ) : (
                            <span className="font-semibold">
                              {formData.emergency_contact_name || formData.emergency_contact_phone ? 
                                `${formData.emergency_contact_name || ''} ${formData.emergency_contact_phone ? `- ${formData.emergency_contact_phone}` : ''}` 
                                : "-"}
                            </span>
                          )}
                        </div>
                      </div>
                    </details>

                    {/* Experiência Profissional (Accordion) */}
                    <details className="group rounded-xl border bg-card shadow-sm [&_summary::-webkit-details-marker]:hidden">
                      <summary className="flex cursor-pointer items-center justify-between font-bold text-foreground p-5 border-b">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-primary" />
                          Experiência Profissional
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-90" />
                      </summary>
                      <div className="p-5">
                        {experiences.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">Nenhuma experiência profissional registrada.</p>
                        ) : (
                          <div className="space-y-4">
                            {experiences.map((exp, i) => (
                              <div key={i} className="p-4 rounded-xl border bg-muted/30 text-sm space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="font-bold text-foreground text-base">{exp.role || "Cargo / Função"}</p>
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${exp.current ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                                    {exp.current ? "Atual" : [exp.start_date, exp.end_date].filter(Boolean).join(" - ")}
                                  </span>
                                </div>
                                <p className="text-xs font-semibold text-primary">{exp.company || "Empresa"}</p>
                                {exp.activities && (
                                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{exp.activities}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {!isEditing && (
                          <p className="text-xs text-muted-foreground mt-4 italic">* A edição de experiências diretamente na ficha ainda não está disponível.</p>
                        )}
                      </div>
                    </details>

                    {/* Formação Acadêmica (Accordion) */}
                    <details className="group rounded-xl border bg-card shadow-sm [&_summary::-webkit-details-marker]:hidden">
                      <summary className="flex cursor-pointer items-center justify-between font-bold text-foreground p-5 border-b">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-5 w-5 text-primary" />
                          Formação Acadêmica
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-90" />
                      </summary>
                      <div className="p-5">
                        {educations.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">Nenhum registro acadêmico.</p>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {educations.map((edu, i) => (
                              <div key={i} className="p-4 rounded-xl border bg-muted/30 text-sm space-y-1">
                                <p className="font-bold text-foreground">{edu.degree || edu.course || "Formação Acadêmica"}</p>
                                <p className="text-xs text-muted-foreground font-medium">{edu.institution || "Instituição não informada"}</p>
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t mt-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-muted text-foreground font-medium">{edu.status || "Concluído"}</span>
                                  <span>{[edu.start_date, edu.end_date].filter(Boolean).join(" até ")}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </details>

                    {/* Diversidade & Info Adicional (Accordion) */}
                    <details className="group rounded-xl border bg-card shadow-sm [&_summary::-webkit-details-marker]:hidden">
                      <summary className="flex cursor-pointer items-center justify-between font-bold text-foreground p-5 border-b">
                        <div className="flex items-center gap-2">
                          <Heart className="h-5 w-5 text-primary" />
                          Diversidade & Info Adicional
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-90" />
                      </summary>
                      <div className="p-5 grid gap-4 sm:grid-cols-2 md:grid-cols-3 text-sm">
                        <div className="space-y-1.5">
                          <span className="text-xs text-muted-foreground block font-medium">Autodeclaração de Gênero</span>
                          {isEditing ? (
                            <Input value={formData.gender_identity || ""} onChange={(e) => handleChange('gender_identity', e.target.value)} />
                          ) : (
                            <span className="font-semibold">{formData.gender_identity || "-"}</span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-xs text-muted-foreground block font-medium">Orientação Sexual</span>
                          {isEditing ? (
                            <Input value={formData.sexual_orientation || ""} onChange={(e) => handleChange('sexual_orientation', e.target.value)} />
                          ) : (
                            <span className="font-semibold">{formData.sexual_orientation || "-"}</span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-xs text-muted-foreground block font-medium">Autodeclaração de Raça</span>
                          {isEditing ? (
                            <Input value={formData.race_declaration || ""} onChange={(e) => handleChange('race_declaration', e.target.value)} />
                          ) : (
                            <span className="font-semibold">{formData.race_declaration || "-"}</span>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-xs text-muted-foreground block font-medium">Pretensão Salarial</span>
                          {isEditing ? (
                            <Input value={formData.salary_expectation || ""} onChange={(e) => handleChange('salary_expectation', e.target.value)} />
                          ) : (
                            <span className="font-semibold">{formData.salary_expectation || "-"}</span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-xs text-muted-foreground block font-medium">Idiomas</span>
                          {isEditing ? (
                            <Input value={formData.languages || ""} onChange={(e) => handleChange('languages', e.target.value)} />
                          ) : (
                            <span className="font-semibold">{formData.languages || "-"}</span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-xs text-muted-foreground block font-medium">Tamanho Uniforme / Botina</span>
                          {isEditing ? (
                            <div className="flex gap-2">
                              <Input placeholder="Uniforme" value={formData.uniform_size || ""} onChange={(e) => handleChange('uniform_size', e.target.value)} />
                              <Input placeholder="Botina" value={formData.boot_size || ""} onChange={(e) => handleChange('boot_size', e.target.value)} />
                            </div>
                          ) : (
                            <span className="font-semibold">
                              {formData.uniform_size || formData.boot_size ? 
                                `${formData.uniform_size ? `Uniforme: ${formData.uniform_size}` : ''} ${formData.boot_size ? `Botina: ${formData.boot_size}` : ''}` 
                                : "-"}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1.5 md:col-span-3">
                          <span className="text-xs text-muted-foreground block font-medium">Possui Dependentes?</span>
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <select 
                                value={formData.has_dependents ? "true" : "false"} 
                                onChange={(e) => handleChange('has_dependents', e.target.value === "true")}
                                className="flex h-10 w-24 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                              >
                                <option value="false">Não</option>
                                <option value="true">Sim</option>
                              </select>
                              {formData.has_dependents && (
                                <Input placeholder="Qtd. e observações (ex: 2 filhos menores)" value={formData.dependents_notes || ""} onChange={(e) => handleChange('dependents_notes', e.target.value)} className="flex-1" />
                              )}
                            </div>
                          ) : (
                            <span className="font-semibold">
                              {formData.has_dependents ? `Sim. ${formData.dependents_notes || ''}` : "Não"}
                            </span>
                          )}
                        </div>
                      </div>
                    </details>
                  </div>
                )}

                {activeTab === "assessment" && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <h2 className="text-2xl font-bold mb-6">Parecer & Avaliação</h2>
                    {isEditing ? (
                      <CandidateAssessmentTab 
                        assessmentData={assessmentData} 
                        isEditing={true} 
                        onChange={handleAssessmentChange} 
                      />
                    ) : (
                      <div className="space-y-4">
                        {interviews.map((int) => {
                          const ass = int.assessment || {};
                          return (
                            <div key={int.id} className="p-6 rounded-xl border bg-card shadow-sm space-y-5">
                              <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4 mb-4">
                                <div>
                                  <p className="font-bold text-lg text-foreground">{int.role || "Cargo Alvo"}</p>
                                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                                    <Calendar className="h-4 w-4" /> 
                                    Data: {int.interview_date ? new Date(int.interview_date + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/I'} — Avaliador: <span className="font-medium text-foreground">{int.evaluator || "RH"}</span>
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {ass.selection_stage && (
                                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
                                      {ass.selection_stage}
                                    </span>
                                  )}
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                    int.result === "Aprovado" || int.result === "Contratado" ? "bg-emerald-100 text-emerald-800" :
                                    int.result === "Reprovado" ? "bg-rose-100 text-rose-800" :
                                    "bg-amber-100 text-amber-800"
                                  }`}>
                                    {int.result || int.status}
                                  </span>
                                </div>
                              </div>
                              <CandidateAssessmentTab 
                                assessmentData={ass} 
                                isEditing={false} 
                                onChange={() => {}} 
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "behavioral" && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold">Teste Comportamental (Big Five)</h2>
                      <span className="text-sm font-semibold text-muted-foreground px-3 py-1 bg-card border rounded-md shadow-sm">{results.length} avaliações</span>
                    </div>

                    {results.length === 0 ? (
                      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground space-y-3 bg-card/50">
                        <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/40" />
                        <p className="font-medium text-foreground text-lg">Nenhum mapeamento concluído</p>
                        <p className="text-sm max-w-md mx-auto">O candidato ainda não respondeu ao teste de perfil comportamental BFI-44.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {results.map((res, idx) => (
                          <div key={res.id} className="relative rounded-xl border bg-card p-6 shadow-sm space-y-6">
                            {idx === 0 && <span className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-sm">Mais Recente</span>}
                            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground pb-3 border-b">
                              <Calendar className="h-4 w-4 text-primary" /> Realizado em: {new Date(res.created_at).toLocaleDateString('pt-BR')}
                            </div>
                            
                            <div className="space-y-5">
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

                {activeTab === "history" && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <h2 className="text-2xl font-bold mb-6">Histórico de Etapas</h2>
                    {candidateInterviews.length === 0 ? (
                      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground bg-card/50">
                        <History className="h-8 w-8 mx-auto mb-3 opacity-50" />
                        <p className="font-medium text-foreground">Nenhum histórico de etapas registrado na Central.</p>
                      </div>
                    ) : (
                      <div className="relative border-l-2 border-muted ml-3 space-y-8 pb-4">
                        {candidateInterviews.map((ci, idx) => (
                          <div key={ci.id} className="relative pl-6">
                            <div className="absolute w-3.5 h-3.5 bg-primary rounded-full -left-[9px] top-1.5 ring-4 ring-background" />
                            <div className="bg-card border rounded-xl p-4 shadow-sm space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-base text-foreground">{ci.stage}</span>
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                                  {new Date(ci.created_at).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                              {(ci.workplace_name || ci.interviewer_name) && (
                                <p className="text-sm text-muted-foreground flex gap-3">
                                  {ci.workplace_name && <span><Building2 className="inline h-3.5 w-3.5 mr-1" /> {ci.workplace_name}</span>}
                                  {ci.interviewer_name && <span><User className="inline h-3.5 w-3.5 mr-1" /> {ci.interviewer_name}</span>}
                                </p>
                              )}
                              {ci.notes && (
                                <div className="mt-2 text-sm bg-muted/40 p-3 rounded-lg border">
                                  <span className="font-semibold block mb-1">Observações:</span>
                                  {ci.notes}
                                </div>
                              )}
                              {ci.rejection_reason && (
                                <div className="mt-2 text-sm bg-rose-500/10 text-rose-800 p-3 rounded-lg border border-rose-500/20">
                                  <span className="font-semibold block mb-1">Motivo Reprovação / Desistência:</span>
                                  {ci.rejection_reason}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BigFiveBar({ label, score, color }: { label: string; score: number | null; color: string }) {
  const percentage = score ? Math.min(100, Math.max(0, (score / 5) * 100)) : 0;
  
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span className="font-bold text-foreground">{label}</span>
        <span className="font-bold text-primary">{score ? score.toFixed(1) : "N/A"} / 5.0</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
        {score !== null && (
          <div 
            className={`h-full rounded-full ${color} transition-all duration-700`} 
            style={{ width: `${percentage}%` }}
          />
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground font-medium">
        <span>Baixo (1)</span>
        <span>Médio (3)</span>
        <span>Alto (5)</span>
      </div>
    </div>
  );
}

