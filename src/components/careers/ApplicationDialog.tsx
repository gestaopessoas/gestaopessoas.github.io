"use client";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { Send, Loader2, ClipboardCheck, Plus, X, Paperclip, CheckCircle2 } from "lucide-react";
import { useRef, useState } from "react";
import { maskCpf, maskPhone, maskCep, maskAddressNumber, maskUf, isValidPhone, onlyDigits, safeFileName } from "@/lib/masks";
import { isValidCpf, maskCurrencyInput } from "@/app/dashboard/colaboradores/lib/employeeFormRules.mjs";
import { CONSENT_VERSION } from "./consent";
import { monthEndDate, normalizeResumeDate } from "@/lib/resumeDate";
import type { Career } from "./types";

const MARITAL_STATUS_OPTIONS = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável"];
const EDUCATION_OPTIONS = [
  "Fundamental Incompleto", "Fundamental Completo",
  "Médio Incompleto", "Médio Completo",
  "Técnico", "Superior Incompleto", "Superior Completo",
  "Pós-graduação", "Mestrado", "Doutorado",
];
const LANGUAGE_LEVELS = ["Básico", "Intermediário", "Avançado", "Fluente", "Nativo"];

// Dado sensível do art. 11 da LGPD. Texto livre travava o candidato ("escrevo o
// quê?") e chegava impossível de agregar em indicador. Lista fechada, com
// "Prefiro não informar" como valor inicial — o preenchimento é voluntário e não
// entra na avaliação (ver /privacidade).
const NAO_INFORMAR = "Prefiro não informar";
const RACE_OPTIONS = [NAO_INFORMAR, "Branca", "Preta", "Parda", "Amarela", "Indígena"];
const GENDER_OPTIONS = [NAO_INFORMAR, "Mulher cisgênero", "Homem cisgênero", "Mulher transgênero", "Homem transgênero", "Não binária", "Outro"];
const ORIENTATION_OPTIONS = [NAO_INFORMAR, "Heterossexual", "Homossexual", "Bissexual", "Assexual", "Outro"];

const RESUME_MAX_BYTES = 5 * 1024 * 1024;
const RESUME_ACCEPT = ".pdf,.doc,.docx";
const RESUME_EXTENSIONS = ["pdf", "doc", "docx"];
const RESUME_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// O bucket `resumes` recusa tipo fora dessa lista (migration 20260916200000). `File.type` vem
// vazio em parte dos navegadores, principalmente com .doc, então a extensão — que pickResume
// já validou — manda, e o tipo do navegador é só reserva.
function resumeMimeType(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return RESUME_MIME_BY_EXTENSION[extension] ?? file.type ?? "application/octet-stream";
}

// Idade mínima para contratação (CLT, fora aprendiz). Sem esse teto o campo aceita
// data futura ou candidato de 3 anos, e o erro só aparece na admissão.
const MAX_BIRTH_DATE = new Date(Date.now() - 16 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

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
  gender_identity: NAO_INFORMAR,
  sexual_orientation: NAO_INFORMAR,
  race_declaration: NAO_INFORMAR,
  salary_expectation: "",
  has_cnh: "" as "" | "sim" | "nao",
  is_pcd: false,
  pcd_description: "",
};

type LanguageRow = { language: string; proficiency: string };
type EducationRow = { level: string; institution: string };
type ExperienceRow = { company: string; role: string; start: string; end: string; isCurrent: boolean; description: string };

const emptyEducationRow: EducationRow = { level: "", institution: "" };
const emptyExperienceRow: ExperienceRow = { company: "", role: "", start: "", end: "", isCurrent: false, description: "" };


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
  const [phoneError, setPhoneError] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentError, setConsentError] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState("");
  const [savedCandidateId, setSavedCandidateId] = useState("");
  const lastCepLookup = useRef("");
  const phoneRef = useRef<HTMLInputElement>(null);
  const cpfRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLDivElement>(null);

  // CPF e telefone secundário moram em seção opcional, que pode estar recolhida quando o
  // erro aparece. Sem rolar até ele, o candidato clica em Enviar e vê a tela não fazer nada.
  const focusInvalidField = (ref: React.RefObject<HTMLInputElement | null>) => {
    // Abrir o `<details>` antes de rolar: o navegador não expande sozinho para receber foco,
    // e rolar até um campo recolhido leva o candidato a uma seção fechada.
    ref.current?.closest("details")?.setAttribute("open", "");
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    ref.current?.focus({ preventScroll: true });
  };

  // Mesmo motivo, para a validação do próprio navegador: `type="email"` num campo dentro de
  // seção recolhida barra o envio sem conseguir mostrar o balão, e a tela parece travada.
  const revealOnInvalid = (event: React.FormEvent<HTMLElement>) => {
    event.currentTarget.closest("details")?.setAttribute("open", "");
  };

  const reset = () => {
    setCandidate(emptyCandidate);
    setLanguages([{ language: "", proficiency: "" }]);
    setEducations([{ ...emptyEducationRow }]);
    setExperiences([{ ...emptyExperienceRow }]);
    setError("");
    setCpfError("");
    setCepError("");
    setPhoneError("");
    setConsentAccepted(false);
    setConsentError("");
    setResumeFile(null);
    setResumeError("");
    setSavedCandidateId("");
    lastCepLookup.current = "";
  };

  const pickResume = (file: File | null) => {
    setResumeError("");
    if (!file) { setResumeFile(null); return; }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!RESUME_EXTENSIONS.includes(ext)) {
      setResumeError("Formato não aceito. Envie PDF, DOC ou DOCX.");
      setResumeFile(null);
      return;
    }
    if (file.size > RESUME_MAX_BYTES) {
      setResumeError("Arquivo acima de 5 MB. Envie uma versão menor.");
      setResumeFile(null);
      return;
    }
    setResumeFile(file);
  };

  const update = <K extends keyof typeof emptyCandidate>(field: K, value: typeof emptyCandidate[K]) => {
    setCandidate((prev) => ({ ...prev, [field]: value }));
  };

  const lookupCep = async (rawCep: string) => {
    const digits = onlyDigits(rawCep);
    if (digits.length !== 8) return;
    // Dispara no onChange, então o mesmo CEP chega a cada tecla depois do oitavo
    // dígito. Sem essa guarda o ViaCEP leva uma consulta por tecla.
    if (digits === lastCepLookup.current) return;
    lastCepLookup.current = digits;
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
  const updateExperienceRow = <K extends keyof ExperienceRow>(index: number, field: K, value: ExperienceRow[K]) => {
    setExperiences((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!job) return;

    if (candidate.cpf && !isValidCpf(candidate.cpf)) {
      setCpfError("CPF inválido.");
      focusInvalidField(cpfRef);
      return;
    }
    setCpfError("");

    // A máscara garante que só entra dígito, mas não que o número está completo:
    // "(53) 9982" passa pela máscara e chega ao banco como telefone inútil.
    if (!isValidPhone(candidate.phone)) {
      setPhoneError("Telefone incompleto. Informe DDD e número.");
      focusInvalidField(phoneRef);
      return;
    }
    if (candidate.secondary_phone && !isValidPhone(candidate.secondary_phone)) {
      setPhoneError("Telefone secundário incompleto.");
      focusInvalidField(phoneRef);
      return;
    }
    setPhoneError("");

    // Consentimento não registrado é consentimento que não aconteceu: sem o
    // timestamp gravado não há como provar o aceite se ele for questionado.
    if (!consentAccepted) {
      setConsentError("É preciso aceitar a Política de Privacidade para enviar a candidatura.");
      consentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setConsentError("");
    setSaving(true);
    setError("");

    const [firstName, ...lastParts] = candidate.full_name.trim().split(/\s+/);
    const supabase = createClient();

    // A lista de candidatos por vaga (dashboard/vagas/candidatos) mostra um resumo de
    // uma linha lido de candidates.experience_summary — não sabe ler candidate_experiences.
    // Gerar esse resumo aqui evita reescrever a tela só pra ela enxergar experiências
    // que já viraram linhas estruturadas.
    const validExperiences = experiences.filter((row) => row.company.trim() || row.role.trim());
    const experienceSummary = validExperiences
      .map((row) => [row.role.trim(), row.company.trim()].filter(Boolean).join(" na "))
      .filter(Boolean)
      .join("; ");

    // Sem .select() após o insert: anon não tem policy de SELECT em candidates
    // (protege PII), e PostgREST precisa reler a linha pra devolver representation.
    // Sem essa leitura o insert inteiro estoura RLS e dá rollback. Gerando o id no
    // client evita depender de ler a linha de volta.
    let candidateId = crypto.randomUUID();
    let isExistingCandidate = false;

    // Upload antes do insert porque `resume_url` vai na mesma linha. Se falhar,
    // aborta sem gravar: o formulário continua preenchido na tela, então o
    // candidato tenta de novo sem perder nada do que digitou.
    let resumePath: string | null = null;
    if (resumeFile) {
      const upload = await supabase.storage
        .from("resumes")
        .upload(
          `${candidateId}/${crypto.randomUUID()}-${safeFileName(resumeFile.name)}`,
          resumeFile,
          // O bucket só aceita os tipos de RESUME_EXTENSIONS. Navegador às vezes entrega
          // `File.type` vazio (comum com .doc), e aí o Storage assumiria
          // application/octet-stream e recusaria um currículo válido.
          { contentType: resumeMimeType(resumeFile) },
        );
      if (upload.error) {
        setResumeError("Não foi possível enviar o currículo: " + upload.error.message);
        setSaving(false);
        return;
      }
      resumePath = upload.data.path;
    }
    const { error: candidateError } = await withRetry(() => supabase
      .from("candidates")
      .insert({
        id: candidateId,
        full_name: sanitizeText(candidate.full_name, 200),
        first_name: sanitizeText(firstName || "", 100),
        last_name: sanitizeText(lastParts.join(" ") || firstName || "", 100),
        email: sanitizeText(candidate.email, 255) || null,
        secondary_email: sanitizeText(candidate.secondary_email, 255) || null,
        phone: sanitizeText(candidate.phone, 20) || null,
        secondary_phone: sanitizeText(candidate.secondary_phone, 20) || null,
        city: sanitizeText(candidate.city, 100) || null,
        state: sanitizeText(candidate.state, 50) || null,
        linkedin_url: sanitizeText(candidate.linkedin_url, 500) || null,
        resume_url: resumePath,
        consent_accepted_at: new Date().toISOString(),
        consent_version: CONSENT_VERSION,
        birth_date: candidate.birth_date || null,
        cpf: onlyDigits(candidate.cpf) || null,
        birthplace: sanitizeText(candidate.birthplace, 200) || null,
        marital_status: candidate.marital_status || null,
        cep: onlyDigits(candidate.cep) || null,
        address: sanitizeText(candidate.address, 300) || null,
        address_number: sanitizeText(candidate.address_number, 20) || null,
        address_complement: sanitizeText(candidate.address_complement, 100) || null,
        neighborhood: sanitizeText(candidate.neighborhood, 150) || null,
        experience_summary: sanitizeText(experienceSummary, 2000) || null,
        gender_identity: candidate.gender_identity === NAO_INFORMAR ? null : sanitizeText(candidate.gender_identity, 200) || null,
        sexual_orientation: candidate.sexual_orientation === NAO_INFORMAR ? null : sanitizeText(candidate.sexual_orientation, 200) || null,
        race_declaration: candidate.race_declaration === NAO_INFORMAR ? null : sanitizeText(candidate.race_declaration, 200) || null,
        salary_expectation: sanitizeText(candidate.salary_expectation, 50) || null,
        // Vazio = não respondeu. A coluna é nullable, então "não informou" não
        // vira "não tem" — que era o efeito do default "Não" na tela.
        has_cnh: candidate.has_cnh === "" ? null : candidate.has_cnh === "sim",
        is_pcd: candidate.is_pcd,
        pcd_description: candidate.is_pcd ? sanitizeText(candidate.pcd_description, 500) || null : null,
        // Dependentes, tamanho de uniforme e tamanho de botina saíram do formulário público
        // (issue #100): são dados de admissão — ninguém compra EPI para candidato. As colunas
        // continuam existindo e o RH preenche na ficha, em /dashboard/central-candidato.
        role_interest: job.profile?.title || null,
        search_tags: [job.profile?.title, job.department, job.cost_center].filter(Boolean),
      }));

    if (candidateError) {
      // 23505 = e-mail já tem candidato cadastrado. Comum quando a candidatura anterior
      // criou o candidato mas caiu antes de vincular a vaga (rede instável no celular) —
      // em vez de travar o candidato num beco sem saída, reaproveita o cadastro existente
      // e segue só pro vínculo com a vaga. find_candidate_id_by_email só devolve o id,
      // nunca dados pessoais (anon não tem SELECT em candidates).
      if (candidateError.code === "23505") {
        // Sem e-mail, o par de reconhecimento é o telefone — que é obrigatório e
        // validado. Ordem de casamento do ADR 0010: e-mail, depois telefone.
        const { data: existingId } = candidate.email
          ? await supabase.rpc("find_candidate_id_by_email", { p_email: sanitizeText(candidate.email, 255) })
          : await supabase.rpc("find_candidate_id_by_phone", { p_phone: sanitizeText(candidate.phone, 20) });
        if (!existingId) {
          setSaving(false);
          setError(
            candidate.email
              ? "Este e-mail já está cadastrado em uma candidatura. Use outro e-mail ou avise o RH."
              : "Este telefone já está cadastrado em uma candidatura. Avise o RH."
          );
          return;
        }
        candidateId = existingId as string;
        isExistingCandidate = true;
      } else {
        setSaving(false);
        setError("Não foi possível cadastrar seus dados. Confira o e-mail e tente novamente.");
        return;
      }
    }

    if (!isExistingCandidate) {
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

      if (validExperiences.length > 0) {
        const { error: expError } = await supabase.from("candidate_experiences").insert(
          validExperiences.map((row) => ({
            candidate_id: candidateId,
            company_name: sanitizeText(row.company, 200) || "Não informado",
            position_title: sanitizeText(row.role, 200) || "Não informado",
            // `<input type="month">` devolve "AAAA-MM" e as colunas são `date`.
            start_date: normalizeResumeDate(row.start),
            end_date: row.isCurrent ? null : monthEndDate(row.end),
            is_current: row.isCurrent,
            description: sanitizeText(row.description, 2000) || null,
          }))
        );
        if (expError) console.warn("Erro ao salvar experiência:", expError.message);
      }
    }

    if (!isExistingCandidate) {
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
    }

    const { error: applicationError } = await withRetry(() => supabase
      .from("job_applications")
      // A Etapa canônica do topo do funil (ADR 0006). Era "Nova Aplicação", grafia que só esta
      // tela usava e que o trigger de tradução da Fase 1 convertia — o trigger morre na Fase 3.
      .insert({ candidate_id: candidateId, job_opening_id: job.id, status: "Nova" }));

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

    // Antes daqui a candidatura já está gravada. Redirecionar direto para o teste
    // fazia o modal sumir sem confirmar nada: quem fechava a aba no questionário
    // acreditava ter perdido a inscrição.
    setSavedCandidateId(candidateId);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="max-h-[90vh] max-w-5xl sm:max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Candidatar-se a {job?.profile?.title || "esta vaga"}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-1.5">
            {savedCandidateId ? (
              <span>Candidatura registrada.</span>
            ) : (
              <>
                <span>Etapa 1 de 2: seus dados.</span>
                <span className="inline-flex items-center gap-1 font-medium text-primary"><ClipboardCheck className="h-3.5 w-3.5" /> Depois do envio vem um questionário de perfil, de 5 a 10 minutos.</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {savedCandidateId ? (
          <div className="space-y-5 py-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Sua candidatura foi registrada</h3>
              <p className="text-sm text-muted-foreground">
                Você já está inscrito em {job?.profile?.title || "esta vaga"}. Nada mais é obrigatório
                a partir daqui — o RH consegue ver seus dados.
              </p>
            </div>
            <div className="rounded-md border bg-muted/40 p-4 text-left text-sm">
              <p className="font-medium">Próxima etapa, opcional: mapeamento de perfil</p>
              <p className="mt-1 text-muted-foreground">
                44 afirmações curtas, de 5 a 10 minutos. Não há resposta certa ou errada. Responder
                ajuda o recrutador a entender seu estilo de trabalho, e você pode deixar para depois.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="w-full"
                onClick={() => window.location.assign(`/candidato/teste-personalidade?candidate_id=${savedCandidateId}`)}
              >
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Responder agora
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => { onOpenChange(false); reset(); }}>
                Responder depois
              </Button>
            </div>
          </div>
        ) : (
        <form onSubmit={submit} className="space-y-6">
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

          {/* Issue #100: os obrigatórios são estes dois, e o formulário tinha ~35 campos em
              coluna única antes do botão de envio. Quem abria no celular lia a tela como "35
              campos obrigatórios" e desistia. Aqui fica só o essencial, com o envio logo
              abaixo; o resto é opcional e vem recolhido depois. */}
          <div className="space-y-3 rounded-md border p-4">
            <div>
              <h3 className="text-sm font-semibold">O essencial</h3>
              <p className="text-xs text-muted-foreground">Com isto já dá para enviar. O resto é opcional.</p>
            </div>
            <Field label="Nome completo *"><Input required disabled={!job} value={candidate.full_name} onChange={(event) => update("full_name", event.target.value)} /></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Telefone *">
                <Input ref={phoneRef} required disabled={!job} inputMode="numeric" placeholder="(00) 00000-0000" value={candidate.phone} onChange={(event) => { setPhoneError(""); update("phone", maskPhone(event.target.value)); }} aria-invalid={!!phoneError} />
                {phoneError && <p role="alert" className="text-xs text-destructive">{phoneError}</p>}
              </Field>
              <Field label="E-mail"><Input disabled={!job} type="email" value={candidate.email} onChange={(event) => update("email", event.target.value)} /></Field>
            </div>
            <div>
              <p className="text-xs font-medium">Currículo <span className="font-normal text-muted-foreground">— opcional, mas ajuda o recrutador</span></p>
              <label className="mt-1.5 flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-input px-4 py-5 text-center text-sm hover:bg-muted/40">
                <Paperclip className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{resumeFile ? resumeFile.name : "Escolher arquivo"}</span>
                <span className="text-xs text-muted-foreground">
                  {resumeFile ? `${(resumeFile.size / 1024 / 1024).toFixed(1)} MB — toque para trocar` : "PDF, DOC ou DOCX, até 5 MB"}
                </span>
                <input
                  type="file"
                  className="sr-only"
                  accept={RESUME_ACCEPT}
                  disabled={!job}
                  onChange={(event) => pickResume(event.target.files?.[0] ?? null)}
                />
              </label>
              {resumeFile && (
                <button type="button" className="mt-1.5 text-xs text-muted-foreground underline underline-offset-2" onClick={() => pickResume(null)}>
                  Remover currículo
                </button>
              )}
              {resumeError && <p role="alert" className="mt-1.5 text-xs text-destructive">{resumeError}</p>}
            </div>
          </div>

          <div ref={consentRef} className="rounded-md border border-border p-4">
            <label className="flex items-start gap-3 text-sm">
              <Checkbox className="mt-0.5" checked={consentAccepted} onCheckedChange={(checked) => { setConsentError(""); setConsentAccepted(checked === true); }} aria-invalid={!!consentError} />
              <span>
                Li e aceito a{" "}
                <a href="/privacidade/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  Política de Privacidade
                </a>
                , e autorizo a ACPO Empreendimentos a tratar meus dados para este processo seletivo
                e para o banco de talentos. Raça, gênero, orientação sexual e condição de PcD são de
                preenchimento opcional.
              </span>
            </label>
            {consentError && <p role="alert" className="mt-2 text-xs text-destructive">{consentError}</p>}
          </div>

          {/* Grudado no rodapé do diálogo: no celular, o essencial mais o consentimento já
              ocupam a tela inteira, e sem isto o botão fica um fio abaixo da dobra — que é
              metade da queixa da issue #100. Assim ele está à mão em qualquer rolagem. */}
          <div className="sticky bottom-0 z-10 -mx-1 bg-background py-2">
            <Button type="submit" className="w-full" size="lg" disabled={!job || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {saving ? "Enviando..." : "Enviar candidatura"}
            </Button>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Quer aumentar suas chances?</h3>
            <p className="text-xs text-muted-foreground">
              Tudo daqui para baixo é opcional. Quanto mais o recrutador souber, melhor ele consegue
              encaixar você numa vaga — mas nada disto impede sua candidatura.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <div className="space-y-4">
              <FormSection title="Mais sobre você">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Data de nascimento"><Input type="date" min="1930-01-01" max={MAX_BIRTH_DATE} value={candidate.birth_date} onChange={(event) => update("birth_date", event.target.value)} /></Field>
                  <Field label="CPF">
                    <Input ref={cpfRef} inputMode="numeric" placeholder="000.000.000-00" value={candidate.cpf} onChange={(event) => { setCpfError(""); update("cpf", maskCpf(event.target.value)); }} aria-invalid={!!cpfError} />
                    {cpfError && <p role="alert" className="text-xs text-destructive">{cpfError}</p>}
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="E-mail secundário"><Input disabled={!job} type="email" onInvalid={revealOnInvalid} value={candidate.secondary_email} onChange={(event) => update("secondary_email", event.target.value)} /></Field>
                  <Field label="Telefone secundário"><Input disabled={!job} inputMode="numeric" placeholder="(00) 00000-0000" value={candidate.secondary_phone} onChange={(event) => { setPhoneError(""); update("secondary_phone", maskPhone(event.target.value)); }} /></Field>
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
                      <Input inputMode="numeric" placeholder="00000-000" value={candidate.cep} onChange={(event) => { setCepError(""); const masked = maskCep(event.target.value); update("cep", masked); lookupCep(masked); }} />
                      {cepLoading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                    </div>
                    {cepError && <p className="text-xs text-destructive">{cepError}</p>}
                  </Field>
                  <Field label="Bairro"><Input value={candidate.neighborhood} onChange={(event) => update("neighborhood", event.target.value)} /></Field>
                </div>
                <Field label="Logradouro"><Input value={candidate.address} onChange={(event) => update("address", event.target.value)} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Número"><Input inputMode="numeric" value={candidate.address_number} onChange={(event) => update("address_number", maskAddressNumber(event.target.value))} /></Field>
                  <Field label="Complemento"><Input value={candidate.address_complement} onChange={(event) => update("address_complement", event.target.value)} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Cidade"><Input disabled={!job} value={candidate.city} onChange={(event) => update("city", event.target.value)} /></Field>
                  <Field label="UF"><Input disabled={!job} maxLength={2} value={candidate.state} onChange={(event) => update("state", maskUf(event.target.value))} /></Field>
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
                  <Button type="button" variant="outline" size="sm" onClick={addEducationRow}><Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar outra formação</Button>
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
                      <div className="flex flex-wrap items-center gap-2">
                        <Label className="text-xs text-muted-foreground" htmlFor={`exp-inicio-${index}`}>Início</Label>
                        <Input
                          id={`exp-inicio-${index}`}
                          type="month"
                          className="w-auto"
                          value={row.start}
                          onChange={(event) => updateExperienceRow(index, "start", event.target.value)}
                        />
                        <Label className="text-xs text-muted-foreground" htmlFor={`exp-fim-${index}`}>Fim</Label>
                        <Input
                          id={`exp-fim-${index}`}
                          type="month"
                          className="w-auto"
                          // Fim antes do início daria tempo de experiência negativo, que é
                          // justamente o número que a vaga cobra como requisito.
                          min={row.start || undefined}
                          value={row.isCurrent ? "" : row.end}
                          disabled={row.isCurrent}
                          onChange={(event) => updateExperienceRow(index, "end", event.target.value)}
                        />
                        <Label className="flex items-center gap-1.5 text-xs font-normal">
                          <Checkbox
                            checked={row.isCurrent}
                            onCheckedChange={(checked) => updateExperienceRow(index, "isCurrent", checked === true)}
                          />
                          Trabalho aqui atualmente
                        </Label>
                      </div>
                      <Textarea rows={2} placeholder="Conte um pouco das atividades" value={row.description} onChange={(event) => updateExperienceRow(index, "description", event.target.value)} />
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addExperienceRow}><Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar outra experiência</Button>
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
                  <Button type="button" variant="outline" size="sm" onClick={addLanguageRow}><Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar outro idioma</Button>
                </div>
              </FormSection>

              <FormSection title="Perfil complementar">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Autodeclaração de gênero">
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={candidate.gender_identity} onChange={(event) => update("gender_identity", event.target.value)}>
                      {GENDER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </Field>
                  <Field label="Orientação sexual">
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={candidate.sexual_orientation} onChange={(event) => update("sexual_orientation", event.target.value)}>
                      {ORIENTATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Autodeclaração de raça">
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={candidate.race_declaration} onChange={(event) => update("race_declaration", event.target.value)}>
                      {RACE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Pretensão salarial"><Input value={candidate.salary_expectation} onChange={(event) => update("salary_expectation", maskCurrencyInput(event.target.value))} /></Field>
                  <Field label="Possui CNH?">
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={candidate.has_cnh} onChange={(event) => update("has_cnh", event.target.value as "" | "sim" | "nao")}>
                      <option value="">Selecione...</option>
                      <option value="sim">Sim</option>
                      <option value="nao">Não</option>
                    </select>
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={candidate.is_pcd} onCheckedChange={(checked) => update("is_pcd", checked === true)} />
                  Pessoa com deficiência (PcD)
                </label>
                {candidate.is_pcd && <Field label="Descrição PcD"><Input value={candidate.pcd_description} onChange={(event) => update("pcd_description", event.target.value)} /></Field>}
              </FormSection>
            </div>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// `<details>` nativo em vez de estado de React: recolher seção é exatamente o que a tag faz,
// e assim a seção continua abrindo se o JS falhar, e o Ctrl+F do navegador continua achando
// o campo lá dentro.
function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <details className="group space-y-3 rounded-md border p-4 [&[open]]:pb-4">
      <summary className="cursor-pointer list-none">
        <span className="flex items-center justify-between gap-2">
          <span>
            <span className="text-sm font-semibold">{title}</span>
            {description && <span className="block text-xs font-normal text-muted-foreground">{description}</span>}
          </span>
          <Plus className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-45" />
        </span>
      </summary>
      <div className="space-y-3 pt-3">{children}</div>
    </details>
  );
}

