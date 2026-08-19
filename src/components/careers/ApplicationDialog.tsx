"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { Send, Loader2, FileUp, CheckCircle2, GraduationCap, BriefcaseBusiness, ClipboardCheck } from "lucide-react";
import { useState } from "react";
import { itemsToText } from "@/lib/resumeParser";
import { parseResumeLocally, type ParsedResumeAcademic, type ParsedResumeExperience } from "@/lib/resumeAI";
import type { Career } from "./types";

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

export function ApplicationDialog({ job, open, onOpenChange }: { job: Career | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [candidate, setCandidate] = useState(emptyCandidate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [parsingResume, setParsingResume] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const [parsedAcademics, setParsedAcademics] = useState<ParsedResumeAcademic[]>([]);
  const [parsedExperiences, setParsedExperiences] = useState<ParsedResumeExperience[]>([]);
  const [isDraggingResume, setIsDraggingResume] = useState(false);

  const reset = () => {
    setCandidate(emptyCandidate);
    setResumeFile(null);
    setResumeError("");
    setParsedAcademics([]);
    setParsedExperiences([]);
    setError("");
  };

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
    if (!job) return;
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

    // Sem .select() após o insert: anon não tem policy de SELECT em candidates
    // (protege PII), e PostgREST precisa reler a linha pra devolver representation.
    // Sem essa leitura o insert inteiro estoura RLS e dá rollback. Gerando o id no
    // client evita depender de ler a linha de volta.
    const candidateId = crypto.randomUUID();
    const { error: candidateError } = await supabase
      .from("candidates")
      .insert({
        id: candidateId,
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
        role_interest: job.profile?.title || null,
        search_tags: [job.profile?.title, job.department, job.cost_center].filter(Boolean),
        resume_url: resumePath,
      });

    if (candidateError) {
      setSaving(false);
      setError(
        candidateError.code === "23505"
          ? "Este e-mail já está cadastrado em uma candidatura. Use outro e-mail ou avise o RH."
          : "Não foi possível cadastrar seus dados. Confira o e-mail e tente novamente."
      );
      return;
    }

    if (parsedAcademics.length > 0) {
      const educations = parsedAcademics.map((item) => ({
        candidate_id: candidateId,
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
        candidate_id: candidateId,
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
      .insert({ candidate_id: candidateId, job_opening_id: job.id, status: "Nova Aplicação" });

    setSaving(false);
    if (applicationError) {
      setError("Dados recebidos, mas não foi possível vincular à vaga. Avise o RH.");
      return;
    }

    onOpenChange(false);
    reset();
    window.location.assign(`/candidato/teste-personalidade?candidate_id=${candidateId}`);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Candidatar-se a {job?.profile?.title || "esta vaga"}</DialogTitle>
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
              onDragOver={(event) => { event.preventDefault(); if (job && !parsingResume) setIsDraggingResume(true); }}
              onDragLeave={() => setIsDraggingResume(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDraggingResume(false);
                const file = event.dataTransfer.files?.[0];
                if (file && job && !parsingResume) processResumeFile(file);
              }}
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                isDraggingResume ? "border-primary bg-primary/5" : resumeFile ? "border-green-500/40 bg-green-500/5" : "border-input hover:bg-muted/40"
              } ${!job || parsingResume ? "pointer-events-none opacity-60" : ""}`}
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
              disabled={!job || parsingResume}
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
            <Field label="Nome completo *"><Input required disabled={!job} value={candidate.full_name} onChange={(event) => setCandidate({ ...candidate, full_name: event.target.value })} /></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="E-mail *"><Input required disabled={!job} type="email" value={candidate.email} onChange={(event) => setCandidate({ ...candidate, email: event.target.value })} /></Field>
              <Field label="Telefone"><Input disabled={!job} value={candidate.phone} onChange={(event) => setCandidate({ ...candidate, phone: event.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Data de nascimento"><Input type="date" value={candidate.birth_date} onChange={(event) => setCandidate({ ...candidate, birth_date: event.target.value })} /></Field>
              <Field label="CPF"><Input inputMode="numeric" value={candidate.cpf} onChange={(event) => setCandidate({ ...candidate, cpf: event.target.value })} /></Field>
            </div>
            <Field label="LinkedIn"><Input disabled={!job} value={candidate.linkedin_url} onChange={(event) => setCandidate({ ...candidate, linkedin_url: event.target.value })} /></Field>
          </FormSection>

          <FormSection title="Endereço e disponibilidade">
            <Field label="Endereço"><Input value={candidate.address} onChange={(event) => setCandidate({ ...candidate, address: event.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cidade"><Input disabled={!job} value={candidate.city} onChange={(event) => setCandidate({ ...candidate, city: event.target.value })} /></Field>
              <Field label="UF"><Input disabled={!job} value={candidate.state} onChange={(event) => setCandidate({ ...candidate, state: event.target.value })} /></Field>
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

          <Button type="submit" className="w-full" size="lg" disabled={!job || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {saving ? "Enviando..." : "Enviar candidatura e continuar para o teste"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
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
