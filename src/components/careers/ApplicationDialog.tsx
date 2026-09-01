"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { Send, Loader2, ClipboardCheck, Plus, X } from "lucide-react";
import { useState } from "react";
import { maskCpf, maskPhone, maskCep, onlyDigits } from "@/lib/masks";
import { isValidCpf, maskCurrencyInput } from "@/app/dashboard/colaboradores/lib/employeeFormRules.mjs";
import type { Career } from "./types";

const MARITAL_STATUS_OPTIONS = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável"];
const EDUCATION_OPTIONS = [
  "Fundamental Incompleto", "Fundamental Completo",
  "Médio Incompleto", "Médio Completo",
  "Técnico", "Superior Incompleto", "Superior Completo",
  "Pós-graduação", "Mestrado", "Doutorado",
];
const LANGUAGE_LEVELS = ["Básico", "Intermediário", "Avançado", "Fluente", "Nativo"];

// Hardening defensivo (não corrige vulnerabilidade real: o insert já é
// parametrizado via PostgREST). Corta em caracteres de controle e no
// tamanho da coluna de destino no banco.
const sanitizeText = (value: string, maxLen: number) => value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim().slice(0, maxLen);

const emptyCandidate = {
  full_name: "",
  email: "",
  secondary_email: "",
  phone: "",
  secondary_phone: "",
  birth_date: "",
  cpf: "",
  birthplace: "",
  marital_status: "",
  linkedin_url: "",
  cep: "",
  address: "",
  address_number: "",
  address_complement: "",
  neighborhood: "",
  city: "",
  state: "",
  gender_identity: "",
  sexual_orientation: "",
  race_declaration: "",
  salary_expectation: "",
  has_cnh: false,
  is_pcd: false,
  pcd_description: "",
  has_dependents: false,
  dependents_count: "",
  dependents_notes: "",
  uniform_size: "",
  boot_size: "",
};

type LanguageRow = { language: string; proficiency: string };
type EducationRow = { level: string; institution: string };
type ExperienceRow = { company: string; role: string; description: string };

const emptyEducationRow: EducationRow = { level: "", institution: "" };
const emptyExperienceRow: ExperienceRow = { company: "", role: "", description: "" };

// Erro sem `code` = falha de rede/transiente (fetch caiu no meio do caminho), não
// violação de constraint. Comum em quem preenche esse formulário pelo celular.
// Retry curto evita perder o vínculo candidato-vaga por uma queda de conexão.
const isTransientError = (error: { code?: string } | null) => !!error && !error.code;

async function withRetry<T extends { error: { code?: string } | null }>(
  fn: () => PromiseLike<T>,
  attempts = 3
): Promise<T> {
  let result = await fn();
  for (let i = 1; i < attempts && isTransientError(result.error); i++) {
    await new Promise((resolve) => setTimeout(resolve, 400 * i));
    result = await fn();
  }
  return result;
}

export function ApplicationDialog({ job, open, onOpenChange }: { job: Career | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [candidate, setCandidate] = useState(emptyCandidate);
  const [languages, setLanguages] = useState<LanguageRow[]>([{ language: "", proficiency: "" }]);
  const [educations, setEducations] = useState<EducationRow[]>([{ ...emptyEducationRow }]);
  const [experiences, setExperiences] = useState<ExperienceRow[]>([{ ...emptyExperienceRow }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [cpfError, setCpfError] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");

  const reset = () => {
    setCandidate(emptyCandidate);
    setLanguages([{ language: "", proficiency: "" }]);
    setEducations([{ ...emptyEducationRow }]);
    setExperiences([{ ...emptyExperienceRow }]);
    setError("");
    setCpfError("");
    setCepError("");
  };

  const update = <K extends keyof typeof emptyCandidate>(field: K, value: typeof emptyCandidate[K]) => {
    setCandidate((prev) => ({ ...prev, [field]: value }));
  };

  const lookupCep = async (rawCep: string) => {
    const digits = onlyDigits(rawCep);
    if (digits.length !== 8) return;
    setCepLoading(true);
    setCepError("");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await response.json();
      if (data.erro) {
        setCepError("CEP não encontrado.");
        return;
      }
      setCandidate((prev) => ({
        ...prev,
        address: data.logradouro || prev.address,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
    } catch {
      setCepError("Não foi possível consultar o CEP agora. Preencha o endereço manualmente.");
    } finally {
      setCepLoading(false);
    }
  };

  const addLanguageRow = () => setLanguages((prev) => [...prev, { language: "", proficiency: "" }]);
  const removeLanguageRow = (index: number) => setLanguages((prev) => prev.filter((_, i) => i !== index));
  const updateLanguageRow = (index: number, field: keyof LanguageRow, value: string) => {
    setLanguages((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addEducationRow = () => setEducations((prev) => [...prev, { ...emptyEducationRow }]);
  const removeEducationRow = (index: number) => setEducations((prev) => prev.filter((_, i) => i !== index));
  const updateEducationRow = (index: number, field: keyof EducationRow, value: string) => {
    setEducations((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addExperienceRow = () => setExperiences((prev) => [...prev, { ...emptyExperienceRow }]);
  const removeExperienceRow = (index: number) => setExperiences((prev) => prev.filter((_, i) => i !== index));
  const updateExperienceRow = (index: number, field: keyof ExperienceRow, value: string) => {
    setExperiences((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!job) return;

    if (candidate.cpf && !isValidCpf(candidate.cpf)) {
      setCpfError("CPF inválido.");
      return;
    }
    setCpfError("");
    setSaving(true);
    setError("");

    const [firstName, ...lastParts] = candidate.full_name.trim().split(/\s+/);
    const supabase = createClient();

    // Sem .select() após o insert: anon não tem policy de SELECT em candidates
    // (protege PII), e PostgREST precisa reler a linha pra devolver representation.
    // Sem essa leitura o insert inteiro estoura RLS e dá rollback. Gerando o id no
    // client evita depender de ler a linha de volta.
    const candidateId = crypto.randomUUID();
    const { error: candidateError } = await withRetry(() => supabase
      .from("candidates")
      .insert({
        id: candidateId,
        full_name: sanitizeText(candidate.full_name, 200),
        first_name: sanitizeText(firstName || "", 100),
        last_name: sanitizeText(lastParts.join(" ") || firstName || "", 100),
        email: sanitizeText(candidate.email, 255),
        secondary_email: sanitizeText(candidate.secondary_email, 255) || null,
        phone: sanitizeText(candidate.phone, 20) || null,
        secondary_phone: sanitizeText(candidate.secondary_phone, 20) || null,
        city: sanitizeText(candidate.city, 100) || null,
        state: sanitizeText(candidate.state, 50) || null,
        linkedin_url: sanitizeText(candidate.linkedin_url, 500) || null,
        birth_date: candidate.birth_date || null,
        cpf: onlyDigits(candidate.cpf) || null,
        birthplace: sanitizeText(candidate.birthplace, 200) || null,
        marital_status: candidate.marital_status || null,
        cep: onlyDigits(candidate.cep) || null,
        address: sanitizeText(candidate.address, 300) || null,
        address_number: sanitizeText(candidate.address_number, 20) || null,
        address_complement: sanitizeText(candidate.address_complement, 100) || null,
        neighborhood: sanitizeText(candidate.neighborhood, 150) || null,
        gender_identity: sanitizeText(candidate.gender_identity, 200) || null,
        sexual_orientation: sanitizeText(candidate.sexual_orientation, 200) || null,
        race_declaration: sanitizeText(candidate.race_declaration, 200) || null,
        salary_expectation: sanitizeText(candidate.salary_expectation, 50) || null,
        has_cnh: candidate.has_cnh,
        is_pcd: candidate.is_pcd,
        pcd_description: candidate.is_pcd ? sanitizeText(candidate.pcd_description, 500) || null : null,
        has_dependents: candidate.has_dependents,
        dependents_count: candidate.has_dependents ? Number(onlyDigits(candidate.dependents_count)) || null : null,
        dependents_notes: candidate.has_dependents ? sanitizeText(candidate.dependents_notes, 500) || null : null,
        uniform_size: sanitizeText(candidate.uniform_size, 20) || null,
        boot_size: sanitizeText(candidate.boot_size, 20) || null,
        role_interest: job.profile?.title || null,
        search_tags: [job.profile?.title, job.department, job.cost_center].filter(Boolean),
      }));

    if (candidateError) {
      setSaving(false);
      setError(
        candidateError.code === "23505"
          ? "Este e-mail já está cadastrado em uma candidatura. Use outro e-mail ou avise o RH."
          : "Não foi possível cadastrar seus dados. Confira o e-mail e tente novamente."
      );
      return;
    }

    const validEducations = educations.filter((row) => row.level.trim());
    if (validEducations.length > 0) {
      const { error: eduError } = await supabase.from("candidate_educations").insert(
        validEducations.map((row) => ({
          candidate_id: candidateId,
          institution_name: sanitizeText(row.institution, 200) || "Não informada",
          degree: row.level,
        }))
      );
      if (eduError) console.warn("Erro ao salvar escolaridade:", eduError.message);
    }

    const validExperiences = experiences.filter((row) => row.company.trim() || row.role.trim());
    if (validExperiences.length > 0) {
      const { error: expError } = await supabase.from("candidate_experiences").insert(
        validExperiences.map((row) => ({
          candidate_id: candidateId,
          company_name: sanitizeText(row.company, 200) || "Não informado",
          position_title: sanitizeText(row.role, 200) || "Não informado",
          description: sanitizeText(row.description, 2000) || null,
        }))
      );
      if (expError) console.warn("Erro ao salvar experiência:", expError.message);
    }

    const validLanguages = languages.filter((row) => row.language.trim());
    if (validLanguages.length > 0) {
      const { error: langError } = await supabase.from("candidate_languages").insert(
        validLanguages.map((row) => ({
          candidate_id: candidateId,
          language: sanitizeText(row.language, 100),
          proficiency: row.proficiency || null,
        }))
      );
      if (langError) console.warn("Erro ao salvar idiomas:", langError.message);
    }

    const { error: applicationError } = await withRetry(() => supabase
      .from("job_applications")
      .insert({ candidate_id: candidateId, job_opening_id: job.id, status: "Nova Aplicação" }));

    setSaving(false);
    if (applicationError) {
      console.error("Erro ao vincular candidatura à vaga:", applicationError);
      setError(
        applicationError.code === "23503"
          ? "Esta vaga não está mais disponível. Atualize a página e escolha outra."
          : applicationError.code === "23505"
          ? "Você já se candidatou a esta vaga."
          : "Dados recebidos, mas não foi possível vincular à vaga. Avise o RH."
      );
      return;
    }

    onOpenChange(false);
    reset();
    window.location.assign(`/candidato/teste-personalidade?candidate_id=${candidateId}`);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="max-h-[90vh] max-w-5xl sm:max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Candidatar-se a {job?.profile?.title || "esta vaga"}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-1.5">
            <span>Etapa 1 de 2: seus dados.</span>
            <span className="inline-flex items-center gap-1 font-medium text-primary"><ClipboardCheck className="h-3.5 w-3.5" /> Ao enviar, você segue direto para o teste de perfil.</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-6">
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <FormSection title="Dados pessoais">
                <Field label="Nome completo *"><Input required disabled={!job} value={candidate.full_name} onChange={(event) => update("full_name", event.target.value)} /></Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="E-mail *"><Input required disabled={!job} type="email" value={candidate.email} onChange={(event) => update("email", event.target.value)} /></Field>
                  <Field label="E-mail secundário"><Input disabled={!job} type="email" value={candidate.secondary_email} onChange={(event) => update("secondary_email", event.target.value)} /></Field>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Telefone *"><Input required disabled={!job} inputMode="numeric" placeholder="(00) 00000-0000" value={candidate.phone} onChange={(event) => update("phone", maskPhone(event.target.value))} /></Field>
                  <Field label="Telefone secundário"><Input disabled={!job} inputMode="numeric" placeholder="(00) 00000-0000" value={candidate.secondary_phone} onChange={(event) => update("secondary_phone", maskPhone(event.target.value))} /></Field>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Data de nascimento"><Input type="date" value={candidate.birth_date} onChange={(event) => update("birth_date", event.target.value)} /></Field>
                  <Field label="CPF">
                    <Input inputMode="numeric" placeholder="000.000.000-00" value={candidate.cpf} onChange={(event) => { setCpfError(""); update("cpf", maskCpf(event.target.value)); }} aria-invalid={!!cpfError} />
                    {cpfError && <p role="alert" className="text-xs text-destructive">{cpfError}</p>}
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Naturalidade"><Input value={candidate.birthplace} onChange={(event) => update("birthplace", event.target.value)} /></Field>
                  <Field label="Estado civil">
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={candidate.marital_status} onChange={(event) => update("marital_status", event.target.value)}>
                      <option value="">Selecione...</option>
                      {MARITAL_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="LinkedIn"><Input disabled={!job} value={candidate.linkedin_url} onChange={(event) => update("linkedin_url", event.target.value)} /></Field>
              </FormSection>

              <FormSection title="Endereço" description="Informe o CEP para preencher automaticamente.">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="CEP">
                    <div className="relative">
                      <Input inputMode="numeric" placeholder="00000-000" value={candidate.cep} onChange={(event) => { setCepError(""); update("cep", maskCep(event.target.value)); }} onBlur={(event) => lookupCep(event.target.value)} />
                      {cepLoading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                    </div>
                    {cepError && <p className="text-xs text-destructive">{cepError}</p>}
                  </Field>
                  <Field label="Bairro"><Input value={candidate.neighborhood} onChange={(event) => update("neighborhood", event.target.value)} /></Field>
                </div>
                <Field label="Logradouro"><Input value={candidate.address} onChange={(event) => update("address", event.target.value)} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Número"><Input value={candidate.address_number} onChange={(event) => update("address_number", event.target.value)} /></Field>
                  <Field label="Complemento"><Input value={candidate.address_complement} onChange={(event) => update("address_complement", event.target.value)} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Cidade"><Input disabled={!job} value={candidate.city} onChange={(event) => update("city", event.target.value)} /></Field>
                  <Field label="UF"><Input disabled={!job} maxLength={2} value={candidate.state} onChange={(event) => update("state", event.target.value.toUpperCase())} /></Field>
                </div>
              </FormSection>
            </div>

            <div className="space-y-6">
              <FormSection title="Formação e experiência">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Escolaridade</Label>
                  {educations.map((row, index) => (
                    <div key={index} className="flex gap-2">
                      <select className="flex h-10 w-48 shrink-0 rounded-md border border-input bg-background px-3 text-sm" value={row.level} onChange={(event) => updateEducationRow(index, "level", event.target.value)}>
                        <option value="">Selecione...</option>
                        {EDUCATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                      <Input placeholder="Instituição" value={row.institution} onChange={(event) => updateEducationRow(index, "institution", event.target.value)} />
                      {educations.length > 1 && (
                        <Button type="button" variant="outline" size="icon" onClick={() => removeEducationRow(index)}><X className="h-4 w-4" /></Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addEducationRow}><Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar escolaridade</Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Experiência profissional</Label>
                  {experiences.map((row, index) => (
                    <div key={index} className="space-y-2 rounded-md border border-input p-3">
                      <div className="flex gap-2">
                        <Input placeholder="Empresa" value={row.company} onChange={(event) => updateExperienceRow(index, "company", event.target.value)} />
                        <Input placeholder="Cargo" value={row.role} onChange={(event) => updateExperienceRow(index, "role", event.target.value)} />
                        {experiences.length > 1 && (
                          <Button type="button" variant="outline" size="icon" onClick={() => removeExperienceRow(index)}><X className="h-4 w-4" /></Button>
                        )}
                      </div>
                      <Textarea rows={2} placeholder="Conte um pouco das atividades" value={row.description} onChange={(event) => updateExperienceRow(index, "description", event.target.value)} />
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addExperienceRow}><Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar experiência</Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Idiomas</Label>
                  {languages.map((row, index) => (
                    <div key={index} className="flex gap-2">
                      <Input placeholder="Idioma" value={row.language} onChange={(event) => updateLanguageRow(index, "language", event.target.value)} />
                      <select className="flex h-10 w-40 shrink-0 rounded-md border border-input bg-background px-3 text-sm" value={row.proficiency} onChange={(event) => updateLanguageRow(index, "proficiency", event.target.value)}>
                        <option value="">Nível...</option>
                        {LANGUAGE_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                      </select>
                      {languages.length > 1 && (
                        <Button type="button" variant="outline" size="icon" onClick={() => removeLanguageRow(index)}><X className="h-4 w-4" /></Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addLanguageRow}><Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar idioma</Button>
                </div>
              </FormSection>

              <FormSection title="Perfil complementar">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Autodeclaração de gênero"><Input value={candidate.gender_identity} onChange={(event) => update("gender_identity", event.target.value)} /></Field>
                  <Field label="Orientação sexual"><Input value={candidate.sexual_orientation} onChange={(event) => update("sexual_orientation", event.target.value)} /></Field>
                </div>
                <Field label="Autodeclaração de raça"><Input value={candidate.race_declaration} onChange={(event) => update("race_declaration", event.target.value)} /></Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Pretensão salarial"><Input value={candidate.salary_expectation} onChange={(event) => update("salary_expectation", maskCurrencyInput(event.target.value))} /></Field>
                  <Field label="Possui CNH?">
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={candidate.has_cnh ? "sim" : "nao"} onChange={(event) => update("has_cnh", event.target.value === "sim")}>
                      <option value="nao">Não</option>
                      <option value="sim">Sim</option>
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tamanho uniforme"><Input value={candidate.uniform_size} onChange={(event) => update("uniform_size", event.target.value)} /></Field>
                  <Field label="Tamanho botina"><Input value={candidate.boot_size} onChange={(event) => update("boot_size", event.target.value)} /></Field>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={candidate.is_pcd} onCheckedChange={(checked) => update("is_pcd", checked === true)} />
                  Pessoa com deficiência (PcD)
                </label>
                {candidate.is_pcd && <Field label="Descrição PcD"><Input value={candidate.pcd_description} onChange={(event) => update("pcd_description", event.target.value)} /></Field>}
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={candidate.has_dependents} onCheckedChange={(checked) => update("has_dependents", checked === true)} />
                  Possui dependentes?
                </label>
                {candidate.has_dependents && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Quantidade"><Input inputMode="numeric" value={candidate.dependents_count} onChange={(event) => update("dependents_count", onlyDigits(event.target.value))} /></Field>
                    <Field label="Observações"><Input value={candidate.dependents_notes} onChange={(event) => update("dependents_notes", event.target.value)} /></Field>
                  </div>
                )}
              </FormSection>
            </div>
          </div>

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
