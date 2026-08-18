"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { Briefcase, MapPin, Send, Loader2, FileUp, Inbox, CheckCircle2, GraduationCap, BriefcaseBusiness, ClipboardCheck, Building2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { itemsToText } from "@/lib/resumeParser";
import { parseResumeLocally, type ParsedResumeAcademic, type ParsedResumeExperience } from "@/lib/resumeAI";

type Career = {
  id: string;
  status: string;
  cost_center: string | null;
  contract_type: string | null;
  target_date: string | null;
  observations: string | null;
  created_at: string;
  department: string | null;
  profile: {
    title: string | null;
    profile_code: string | null;
    min_education: string | null;
    desired_education: string | null;
    min_experience: string | null;
    desired_experience: string | null;
    knowledge: string | null;
    activities: string | null;
    competencies: string | null;
  } | null;
};

const emptyCandidate = {
  full_name: "",
  email: "",
  phone: "",
  city: "",
  state: "",
  linkedin_url: "",
  birth_date: "",
  cpf: "",
  address: "",
  salary_expectation: "",
  has_cnh: false,
  is_pcd: false,
  pcd_description: "",
};

export default function CarreirasPage() {
  const [careers, setCareers] = useState<Career[]>([]);
  const [query, setQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<Career | null>(null);
  const [isApplicationOpen, setIsApplicationOpen] = useState(false);
  const [candidate, setCandidate] = useState(emptyCandidate);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [parsingResume, setParsingResume] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const [parsedAcademics, setParsedAcademics] = useState<ParsedResumeAcademic[]>([]);
  const [parsedExperiences, setParsedExperiences] = useState<ParsedResumeExperience[]>([]);
  const [isDraggingResume, setIsDraggingResume] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("get_public_careers").then(async ({ data, error }) => {
      if (error) {
        const fallback = await supabase
          .from("job_openings")
          .select("id,status,cost_center,contract_type,target_date,observations,created_at,profile:job_profiles(title,profile_code,min_education,desired_education,min_experience,desired_experience,knowledge,activities,competencies),department:departments(name)")
          .eq("status", "Aberta")
          .order("created_at", { ascending: false });

        if (fallback.error) {
          setError("Não foi possível carregar vagas abertas.");
          setCareers([]);
        } else {
          const rows = (fallback.data ?? []) as unknown as Array<Career & {
            department: { name: string | null } | { name: string | null }[] | null;
            profile: Career["profile"] | Career["profile"][];
          }>;
          setCareers(rows.map((item) => ({
            ...item,
            profile: Array.isArray(item.profile) ? item.profile[0] ?? null : item.profile ?? null,
            department: Array.isArray(item.department) ? item.department[0]?.name ?? null : item.department?.name ?? null,
          })));
        }
        setLoading(false);
        return;
      }
      setCareers((data ?? []) as Career[]);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return careers;
    return careers.filter((career) => [
      career.profile?.title,
      career.department,
      career.cost_center,
      career.contract_type,
      career.profile?.knowledge,
      career.profile?.competencies,
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [careers, query]);

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processResumeFile(file);
  };

  const processResumeFile = async (file: File) => {
    setResumeFile(file);
    setResumeError("");
    setParsingResume(true);

    try {
      let text = "";
      if (file.type === "application/pdf") {
        // Import dinâmico: pdfjs-dist toca DOMMatrix (API só de browser) na avaliação do
        // módulo, o que quebra o SSR desta página pública se importado no topo do arquivo.
        const pdfjsLib = await import("pdfjs-dist");
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        }
        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += itemsToText(content.items) + "\n";
        }
      } else {
        text = await file.text();
      }

      if (!text.trim()) throw new Error("Texto vazio");

      const parsed = parseResumeLocally(text);

      setCandidate((prev) => ({
        ...prev,
        full_name: prev.full_name || parsed.name,
        email: prev.email || parsed.email,
        phone: prev.phone || parsed.phone,
        city: prev.city || parsed.city,
        state: prev.state || parsed.state,
        linkedin_url: prev.linkedin_url || parsed.linkedin_url,
      }));
      setParsedAcademics(parsed.academic_list);
      setParsedExperiences(parsed.experience_list);
    } catch {
      setResumeError("Não foi possível ler o currículo automaticamente, preencha os campos manualmente.");
    } finally {
      setParsingResume(false);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedJob) return;
    setSaving(true);
    setError("");

    const [firstName, ...lastParts] = candidate.full_name.trim().split(/\s+/);
    const supabase = createClient();

    // Upload antes do insert: anon só tem policy de INSERT em candidates (sem UPDATE),
    // então gravar resume_url via update() depois falharia silenciosamente por RLS para
    // candidatos novos. Fazendo o upload primeiro, o path entra direto no insert.
    let resumePath: string | null = null;
    if (resumeFile) {
      resumePath = `${crypto.randomUUID()}/${resumeFile.name}`;
      const { error: uploadError } = await supabase.storage.from("resumes").upload(resumePath, resumeFile);
      if (uploadError) {
        console.warn("Erro ao enviar currículo:", uploadError.message);
        resumePath = null;
      }
    }

    // Attempt to find existing candidate by email first to avoid duplicate email constraint error
    let { data: candidateData, error: candidateError } = await supabase
      .from("candidates")
      .select("id")
      .eq("email", candidate.email.trim())
      .single();

    if (!candidateData) {
      const res = await supabase
        .from("candidates")
        .insert({
          full_name: candidate.full_name.trim(),
          first_name: firstName,
          last_name: lastParts.join(" ") || firstName,
          email: candidate.email.trim(),
          phone: candidate.phone.trim() || null,
          city: candidate.city.trim() || null,
          state: candidate.state.trim() || null,
          linkedin_url: candidate.linkedin_url.trim() || null,
          birth_date: candidate.birth_date || null,
          cpf: candidate.cpf.trim() || null,
          address: candidate.address.trim() || null,
          salary_expectation: candidate.salary_expectation.trim() || null,
          has_cnh: candidate.has_cnh,
          is_pcd: candidate.is_pcd,
          pcd_description: candidate.is_pcd ? candidate.pcd_description.trim() || null : null,
          role_interest: selectedJob.profile?.title || null,
          search_tags: [selectedJob.profile?.title, selectedJob.department, selectedJob.cost_center].filter(Boolean),
          resume_url: resumePath,
        })
        .select("id")
        .single();
      candidateData = res.data;
      candidateError = res.error;
    } else if (resumePath) {
      // Candidato já existia: anon não tem policy de UPDATE em candidates, então isto é
      // best-effort (provavelmente vira no-op por RLS) — não bloqueia a candidatura.
      const { error: resumeUpdateError } = await supabase.from("candidates").update({ resume_url: resumePath }).eq("id", candidateData.id);
      if (resumeUpdateError) console.warn("Erro ao vincular currículo:", resumeUpdateError.message);
    }

    if (candidateError || !candidateData) {
      setSaving(false);
      setError("Não foi possível cadastrar seus dados. Confira o e-mail e tente novamente.");
      return;
    }

    if (parsedAcademics.length > 0) {
      const educations = parsedAcademics.map((item) => ({
        candidate_id: candidateData.id,
        institution_name: item.institution || "Não informada",
        degree: item.course || "Não informado",
        start_date: item.start_date,
        end_date: item.in_progress ? null : item.end_date,
      }));
      const { error: eduError } = await supabase.from("candidate_educations").insert(educations);
      if (eduError) console.warn("Erro ao salvar formações:", eduError.message);
    }

    if (parsedExperiences.length > 0) {
      const experiences = parsedExperiences.map((item) => ({
        candidate_id: candidateData.id,
        company_name: item.company || "Não informada",
        position_title: item.role || "Não informado",
        start_date: item.start_date,
        end_date: item.is_current ? null : item.end_date,
        is_current: item.is_current,
        description: item.description || "",
      }));
      const { error: expError } = await supabase.from("candidate_experiences").insert(experiences);
      if (expError) console.warn("Erro ao salvar experiências:", expError.message);
    }

    const { error: applicationError } = await supabase
      .from("job_applications")
      .insert({ candidate_id: candidateData.id, job_opening_id: selectedJob.id, status: "Nova Aplicação" });

    setSaving(false);
    if (applicationError) {
      setError("Dados recebidos, mas não foi possível vincular à vaga. Avise o RH.");
      return;
    }

    setIsApplicationOpen(false);
    setCandidate(emptyCandidate);
    setResumeFile(null);
    setResumeError("");
    setParsedAcademics([]);
    setParsedExperiences([]);
    window.location.assign(`/candidato/teste-personalidade?candidate_id=${candidateData.id}`);
  };

  return (
    <main className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-background px-4 py-16">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto max-w-5xl">
          <Badge variant="secondary" className="mb-4">
            <Building2 className="h-3.5 w-3.5" /> ACPO Empreendimentos
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Construa sua carreira com a gente</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
            Vagas abertas conectadas ao perfil de competência e ao processo seletivo interno. Candidate-se em poucos passos: envie seu currículo, confirme seus dados e responda ao teste de perfil.
          </p>
          <div className="mt-6 flex w-full max-w-md items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar por cargo, área ou requisito..." className="pl-9" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Vagas abertas</h2>
            <span className="text-sm text-muted-foreground">{filtered.length} vaga(s)</span>
          </div>

          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
          {loading && (
            <div className="grid gap-4">
              {[0, 1, 2].map((index) => (
                <div key={index} className="animate-pulse space-y-3 rounded-lg border bg-card p-6">
                  <div className="h-5 w-1/3 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                  <div className="h-16 w-full rounded bg-muted" />
                </div>
              ))}
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
              <Inbox className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
              Nenhuma vaga aberta no momento.
            </div>
          )}

          <div className="grid gap-4">
            {filtered.map((career) => (
              <Card key={career.id} className={`transition-all hover:-translate-y-0.5 hover:shadow-lg ${selectedJob?.id === career.id ? "border-primary" : ""}`}>
                <CardHeader>
                  <CardTitle className="text-xl">{career.profile?.title || "Vaga sem título"}</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Badge variant="secondary"><Briefcase className="h-3.5 w-3.5" />{career.contract_type || "Contrato não informado"}</Badge>
                    <span className="inline-flex items-center"><MapPin className="mr-1.5 h-3.5 w-3.5" />{career.cost_center || career.department || "Área não informada"}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-sm leading-6 text-muted-foreground">{career.profile?.activities || career.observations || "Detalhes em alinhamento com o RH."}</p>
                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <Requirement title="Mínimo" text={[career.profile?.min_education, career.profile?.min_experience].filter(Boolean).join(" · ")} />
                    <Requirement title="Desejável" text={[career.profile?.desired_education, career.profile?.desired_experience, career.profile?.knowledge].filter(Boolean).join(" · ")} />
                  </div>
                  <Button className="mt-4" onClick={() => { setSelectedJob(career); setError(""); setIsApplicationOpen(true); }}>
                    <Send className="mr-2 h-4 w-4" />
                    Candidatar-se
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

      </section>

      <Dialog open={isApplicationOpen} onOpenChange={setIsApplicationOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Candidatar-se a {selectedJob?.profile?.title || "esta vaga"}</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-1.5">
              <span>Etapa 1 de 2: seus dados.</span>
              <span className="inline-flex items-center gap-1 font-medium text-primary"><ClipboardCheck className="h-3.5 w-3.5" /> Ao enviar, você segue direto para o teste de perfil.</span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-6">
              {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

              <FormSection title="Currículo" description="Envie um arquivo e preenchemos os campos automaticamente.">
                <label
                  htmlFor="resume-upload"
                  onDragOver={(event) => { event.preventDefault(); if (selectedJob && !parsingResume) setIsDraggingResume(true); }}
                  onDragLeave={() => setIsDraggingResume(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDraggingResume(false);
                    const file = event.dataTransfer.files?.[0];
                    if (file && selectedJob && !parsingResume) processResumeFile(file);
                  }}
                  className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                    isDraggingResume ? "border-primary bg-primary/5" : resumeFile ? "border-green-500/40 bg-green-500/5" : "border-input hover:bg-muted/40"
                  } ${!selectedJob || parsingResume ? "pointer-events-none opacity-60" : ""}`}
                >
                  {parsingResume ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  ) : resumeFile ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  ) : (
                    <FileUp className="h-6 w-6 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">
                    {parsingResume ? "Lendo currículo..." : resumeFile ? resumeFile.name : "Arraste seu currículo aqui ou clique para escolher"}
                  </span>
                  <span className="text-xs text-muted-foreground">PDF ou TXT · opcional, mas acelera o preenchimento</span>
                </label>
                <input
                  id="resume-upload"
                  type="file"
                  accept=".pdf,.txt"
                  className="hidden"
                  disabled={!selectedJob || parsingResume}
                  onChange={handleResumeUpload}
                />
                {resumeError && <p className="text-xs text-destructive">{resumeError}</p>}
                {(parsedAcademics.length > 0 || parsedExperiences.length > 0) && (
                  <div className="flex flex-wrap gap-2">
                    {parsedAcademics.length > 0 && (
                      <Badge variant="secondary"><GraduationCap className="h-3.5 w-3.5" /> {parsedAcademics.length} formação(ões) importada(s)</Badge>
                    )}
                    {parsedExperiences.length > 0 && (
                      <Badge variant="secondary"><BriefcaseBusiness className="h-3.5 w-3.5" /> {parsedExperiences.length} experiência(s) importada(s)</Badge>
                    )}
                  </div>
                )}
              </FormSection>

              <FormSection title="Dados pessoais">
                <Field label="Nome completo *"><Input required disabled={!selectedJob} value={candidate.full_name} onChange={(event) => setCandidate({ ...candidate, full_name: event.target.value })} /></Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="E-mail *"><Input required disabled={!selectedJob} type="email" value={candidate.email} onChange={(event) => setCandidate({ ...candidate, email: event.target.value })} /></Field>
                  <Field label="Telefone"><Input disabled={!selectedJob} value={candidate.phone} onChange={(event) => setCandidate({ ...candidate, phone: event.target.value })} /></Field>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Data de nascimento"><Input type="date" value={candidate.birth_date} onChange={(event) => setCandidate({ ...candidate, birth_date: event.target.value })} /></Field>
                  <Field label="CPF"><Input inputMode="numeric" value={candidate.cpf} onChange={(event) => setCandidate({ ...candidate, cpf: event.target.value })} /></Field>
                </div>
                <Field label="LinkedIn"><Input disabled={!selectedJob} value={candidate.linkedin_url} onChange={(event) => setCandidate({ ...candidate, linkedin_url: event.target.value })} /></Field>
              </FormSection>

              <FormSection title="Endereço e disponibilidade">
                <Field label="Endereço"><Input value={candidate.address} onChange={(event) => setCandidate({ ...candidate, address: event.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Cidade"><Input disabled={!selectedJob} value={candidate.city} onChange={(event) => setCandidate({ ...candidate, city: event.target.value })} /></Field>
                  <Field label="UF"><Input disabled={!selectedJob} value={candidate.state} onChange={(event) => setCandidate({ ...candidate, state: event.target.value })} /></Field>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Pretensão salarial"><Input value={candidate.salary_expectation} onChange={(event) => setCandidate({ ...candidate, salary_expectation: event.target.value })} /></Field>
                  <Field label="Possui CNH?"><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={candidate.has_cnh ? "sim" : "nao"} onChange={(event) => setCandidate({ ...candidate, has_cnh: event.target.value === "sim" })}><option value="nao">Não</option><option value="sim">Sim</option></select></Field>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={candidate.is_pcd} onCheckedChange={(checked) => setCandidate({ ...candidate, is_pcd: checked === true })} />
                  Pessoa com deficiência (PcD)
                </label>
                {candidate.is_pcd && <Field label="Descrição PcD"><Input value={candidate.pcd_description} onChange={(event) => setCandidate({ ...candidate, pcd_description: event.target.value })} /></Field>}
              </FormSection>

              <Button type="submit" className="w-full" size="lg" disabled={!selectedJob || saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {saving ? "Enviando..." : "Enviar candidatura e continuar para o teste"}
              </Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Requirement({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="mt-1 text-sm text-foreground">{text}</div>
    </div>
  );
}
