"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { Search, Download, Briefcase, Calendar, CalendarClock, CalendarPlus, Clock, Trash2, User, CheckCircle2, X, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CandidateProfileModal } from "@/components/CandidateProfileModal";
import { errorMessage } from "@/lib/utils";
import { useToast } from "@/contexts/ToastContext";
import { DEFAULT_RESUME_MODEL } from "@/lib/resumeModelSettings";
import { formatInterviewSchedule, interviewHistoryStage, interviewProgressChanged, roleChangedOnSavedInterview } from "@/lib/interviewProgress.mjs";
import { findExistingCandidateId, hasRealEmail, placeholderEmail } from "@/lib/candidateIdentity.mjs";
import { assessmentToRows, rowsToAssessment } from "@/lib/interviewAssessment.mjs";

type PsychologicalTestInput = {
  test_name: string;
  table_name?: string;
  demographic_type?: string;
  demographic_value?: string;
  score: string | number;
  factors?: {
    N?: string | number;
    E?: string | number;
    O?: string | number;
    A?: string | number;
    C?: string | number;
  }
};

type AcademicRecord = {
  id: string;
  course: string;
  institution: string;
  start_date: string;
  end_date: string;
  in_progress: boolean;
};

type ProfessionalExperienceRecord = {
  id: string;
  role: string;
  company: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  description: string;
};

type Assessment = {
  // Parecer é avaliação, não identidade: CPF, nascimento, CNH e afins moram em
  // `candidates` (issues #77 e #79). As notas de hard/soft skill, o checklist, a
  // senioridade e a bandeira cultural entram por chave dinâmica, direto da ficha.
  psychological_test: string;
  tests_details?: string;
  tests_list?: PsychologicalTestInput[];
  academic_list?: AcademicRecord[];
  experience_list?: ProfessionalExperienceRecord[];
  education?: string;
  strengths?: string;
  weaknesses?: string;
  observations?: string;
  worksite?: string;
  available_worksites?: string[];
  selection_stage?: string;
  is_internal?: boolean;
  [campoDaFicha: string]: unknown;
};


type Interview = {
  id: string;
  role: string | null;
  status: string | null;
  candidate_name: string | null;
  phone: string | null;
  email: string | null;
  interview_date: string | null;
  interview_time: string | null;
  result: string | null;
  destination: string | null;
  candidate_id?: string | null;
  assessment: Assessment | null;
  created_at: string;
  updated_at?: string;
};

const statusStyle: Record<string, string> = {
  Confirmado: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Compareceu: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  Desistente: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
  Aguardando: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

const resultStyle: Record<string, string> = {
  Aprovado: "text-emerald-600",
  Reprovado: "text-red-600",
  "N/C": "text-zinc-500",
};

const destinationStyle: Record<string, string> = {
  Contratado: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "Banco de Talentos": "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  Descartado: "bg-red-500/10 text-red-700 dark:text-red-300",
  Desistente: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
};

const defaultAssessment: Assessment = {
  psychological_test: "Não",
  tests_details: "",
  tests_list: [],
  academic_list: [],
  experience_list: [],
  education: "Ensino Médio",
  strengths: "",
  weaknesses: "",
  observations: "",
  worksite: "",
  available_worksites: [],
  selection_stage: "",
  is_internal: false,
};


export type AIProvider = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  isActive: boolean;
  models: { id: string; name: string }[];
  selectedModel: string;
};

export const defaultProviders: AIProvider[] = [
  { id: "gemini", name: "Gemini (Sistema)", baseUrl: "https://generativelanguage.googleapis.com/v1beta", apiKey: "", isActive: true, models: [], selectedModel: DEFAULT_RESUME_MODEL },
  { id: "9router", name: "9router", baseUrl: "https://rk9xyun.abc-tunnel.us/v1", apiKey: "", isActive: false, models: [], selectedModel: "" },
  { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", apiKey: "", isActive: false, models: [], selectedModel: "" },
  { id: "opencode", name: "Opencode", baseUrl: "https://api.opencode.com/v1", apiKey: "", isActive: false, models: [], selectedModel: "" },
  { id: "nvidia", name: "Nvidia NIM", baseUrl: "https://integrate.api.nvidia.com/v1", apiKey: "", isActive: false, models: [], selectedModel: "nvidia/nemotron-3-ultra-550b-a55b" },
];

// Modelo padrão para as chamadas avulsas desta tela (parecer de teste). A importação de
// currículo usa o modelo configurado pelo administrador — ver analyzeResume.
export default function EntrevistasPage() {
  const { toast } = useToast();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [query, setQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(""); // YYYY-MM
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState<string | null>(null);
  const [form, setForm] = useState({
    candidate_name: "", role: "", phone: "", email: "", interview_date: "", interview_time: "", status: "Aguardando", result: "N/C", destination: ""
  });
  const [assessmentForm, setAssessmentForm] = useState<Assessment>(defaultAssessment);
  // Quem está logado assina a entrevista no histórico — antes ficava sempre "Desconhecido".
  const [currentUserName, setCurrentUserName] = useState("");
  const [stageByCandidate, setStageByCandidate] = useState<Record<string, string>>({});
  
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  // Os provedores salvos já valem no primeiro render — evita renderizar uma vez
  // com os defaults e sobrescrever logo depois.
  const [providers, setProviders] = useState<AIProvider[]>(() => {
    if (typeof window === "undefined") return defaultProviders;
    const stored = localStorage.getItem("ai_providers");
    if (!stored) return defaultProviders;
    try {
      const parsed = JSON.parse(stored) as AIProvider[];
      // Merge with defaults to ensure all providers exist
      return defaultProviders.map(dp => {
        const found = parsed.find((p: AIProvider) => p.id === dp.id);
        return found ? { ...dp, ...found, models: found.models || dp.models, selectedModel: found.selectedModel || dp.selectedModel } : dp;
      });
    } catch (e) {
      console.error("Error loading providers from local storage:", e);
      return defaultProviders;
    }
  });
  const [viewingCandidateProfile, setViewingCandidateProfile] = useState<{ interviewId?: string | null; email?: string | null; name?: string | null } | null>(null);

  const updateProvider = (id: string, updates: Partial<AIProvider>) => {
    const updated = providers.map(p => {
      if (p.id === id) {
        return { ...p, ...updates, isActive: updates.isActive !== undefined ? updates.isActive : p.isActive };
      }
      // If activating a provider, deactivate all others
      if (updates.isActive) return { ...p, isActive: false };
      return p;
    });
    setProviders(updated);
    localStorage.setItem("ai_providers", JSON.stringify(updated));
  };

  const fetchModels = async (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (!provider) return;

    try {
      let models: { id: string; name: string }[] = [];
      if (provider.id === "gemini") {
        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        if (!apiKey) {
          alert("Chave do Gemini não configurada no .env.");
          return;
        }
        const res = await fetch(`${provider.baseUrl}/models?key=${apiKey}`);
        if (!res.ok) throw new Error("Erro ao buscar modelos do Gemini");
        const data = await res.json();
        const geminiModels: { name: string; displayName?: string }[] = data.models || [];
        models = geminiModels
          .filter((m) => m.name.includes("gemini"))
          .map((m) => ({ id: m.name.replace("models/", ""), name: m.displayName || m.name }));
      } else {
        if (!provider.apiKey) {
          alert("API Key não configurada para este provedor.");
          return;
        }
        const res = await fetch(`${provider.baseUrl}/models`, {
          headers: { "Authorization": `Bearer ${provider.apiKey}` }
        });
        if (!res.ok) throw new Error("Erro ao buscar modelos. Verifique a URL e a chave.");
        const data = await res.json();
        const modelsData: { id: string }[] = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
        models = modelsData.map((m) => ({ id: m.id, name: m.id }));
      }

      if (models.length > 0) {
        updateProvider(providerId, { models, selectedModel: models[0].id });
        alert(`Foram encontrados ${models.length} modelos!`);
      } else {
        alert("Nenhum modelo retornado pela API.");
      }
    } catch (e) {
      console.error(e);
      alert(`Falha ao buscar modelos: ${errorMessage(e)}`);
    }
  };

  // `modelOverride` existe para a importação de currículo usar o modelo definido pelo
  // administrador em Configurações › IA, que vale para todo mundo. A seleção de provedor
  // desta tela mora em localStorage, ou seja, é por navegador — serve para experimentar,
  // não para configurar o sistema.
  
  // Test generation states

  const loadInterviews = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("interviews")
      .select("*, interview_assessments(interview_assessment_values(field,item_index,value))")
      .order("interview_date", { ascending: false, nullsFirst: false });

    setLoading(false);
    if (error) {
      setError("Não foi possível carregar as entrevistas.");
      return;
    }
    setInterviews((data ?? []).map((interview: any) => ({
      ...interview,
      assessment: rowsToAssessment(interview.interview_assessments?.interview_assessment_values ?? []),
    })) as Interview[]);

    // Etapa atual do candidato é lida do histórico, não copiada para dentro da entrevista:
    // o Destino continua sendo a decisão daquele dia.
    const candidateIds = Array.from(new Set((data ?? []).map((i: any) => i.candidate_id).filter(Boolean)));
    if (candidateIds.length > 0) {
      const { data: etapas } = await supabase
        .from("candidate_interviews")
        .select("candidate_id, stage, created_at")
        .in("candidate_id", candidateIds)
        .order("created_at", { ascending: false });
      const mapa: Record<string, string> = {};
      for (const etapa of etapas ?? []) {
        if (etapa.candidate_id && etapa.stage && !mapa[etapa.candidate_id]) mapa[etapa.candidate_id] = etapa.stage;
      }
      setStageByCandidate(mapa);
    } else {
      setStageByCandidate({});
    }
  };

  useEffect(() => {
    const run = async () => { await loadInterviews(); };
    run();
  }, []);

  // Vindo do "Avançar e preencher parecer" da Central: abre direto a entrevista criada lá.
  useEffect(() => {
    const alvo = new URLSearchParams(window.location.search).get("entrevista");
    if (!alvo || isModalOpen) return;
    const entrevista = interviews.find((i) => i.id === alvo);
    if (!entrevista) return;
    openEditModal(entrevista);
    window.history.replaceState({}, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviews]);

  // Nome de quem está logado, para assinar o histórico da entrevista.
  useEffect(() => {
    const carregarUsuario = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: perfil } = await supabase.from("profiles").select("name").eq("id", data.user.id).maybeSingle();
      setCurrentUserName(perfil?.name || data.user.email?.split("@")[0] || "");
    };
    carregarUsuario();
  }, []);

  // B1: fecha modais com ESC (modais handrolled sem handler)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsModalOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = useMemo(() => {
    let result = interviews;
    if (selectedMonth) {
      result = result.filter(i => i.interview_date && i.interview_date.startsWith(selectedMonth));
    }
    const term = query.trim().toLowerCase();
    if (term) {
      result = result.filter((interview) => [
        interview.candidate_name,
        interview.role,
        interview.status,
        interview.result,
        interview.email,
      ].some((value) => value?.toLowerCase().includes(term)));
    }
    return result;
  }, [query, selectedMonth, interviews]);

  // Agenda: o que ainda vai acontecer, sem depender do filtro de mês/busca. É a lista que
  // o RH abre de manhã — por isso ignora `filtered` e olha a base inteira.
  const hojeISO = new Date().toLocaleDateString("en-CA");
  const agenda = useMemo(() => {
    const limite = new Date();
    limite.setDate(limite.getDate() + 7);
    const limiteISO = limite.toLocaleDateString("en-CA");
    return interviews
      .filter((i) => i.interview_date && i.interview_date >= hojeISO && i.interview_date <= limiteISO)
      .filter((i) => i.status === "Aguardando" || i.status === "Confirmado")
      .sort((a, b) => `${a.interview_date}${a.interview_time || ""}`.localeCompare(`${b.interview_date}${b.interview_time || ""}`));
  }, [interviews, hojeISO]);
  const agendaHoje = agenda.filter((i) => i.interview_date === hojeISO);

  const confirmados = filtered.filter((i) => i.status === "Confirmado").length;
  const compareceram = filtered.filter((i) => i.status === "Compareceu" || i.result === "Aprovado" || i.result === "Reprovado").length;
  const aprovados = filtered.filter((i) => i.result === "Aprovado").length;

  const exportToCsv = () => {
    if (filtered.length === 0) return;
    const headers = ["Candidato", "Telefone", "Email", "Cargo Alvo", "Data", "Hora", "Status", "Resultado", "Destino"];
    const rows = filtered.map(i => [
      `"${i.candidate_name || ''}"`,
      `"${i.phone || ''}"`,
      `"${i.email || ''}"`,
      `"${i.role || ''}"`,
      `"${i.interview_date ? new Date(i.interview_date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : ''}"`,
      `"${i.interview_time || ''}"`,
      `"${i.status || ''}"`,
      `"${i.result || ''}"`,
      `"${i.destination || ''}"`
    ].join(","));
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `entrevistas_${selectedMonth || 'todas'}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };
  
  const handleModalSave = async (formData: any, assessmentData: any, interviewProgress?: { status: string; result: string; destination?: string; interview_date?: string; interview_time?: string }) => {
    setError("");
    const supabase = createClient();

    const payload = {
      ...Object.fromEntries(
        Object.entries(form).map(([key, value]) => [key, value.trim() || null])
      ),
      status: interviewProgress?.status || form.status,
      result: interviewProgress?.result || form.result,
      destination: interviewProgress?.destination || form.destination || null,
      // Data/hora vêm da ficha: a entrevista marcada fica registrada mesmo sem comparecimento.
      interview_date: interviewProgress?.interview_date || form.interview_date || null,
      interview_time: interviewProgress?.interview_time || form.interview_time || null,
      candidate_name: formData.full_name || formData.name || form.candidate_name,
      email: formData.email,
      phone: formData.phone,
      role: formData.role_interest || formData.role || form.role,
      // O cadastro pessoal (CPF, nascimento, CNH, uniforme...) mora só em `candidates`:
      // duas entrevistas da mesma pessoa criavam duas cópias que divergiam (issue #77).
      updated_at: new Date().toISOString()
    };
    
    // O setError renderiza atrás do overlay do modal, que continua aberto em erro:
    // o aviso de verdade é o toast. `handled` evita que o modal repita a mensagem.
    // Tipo explícito na const: sem ele o TS não sabe que a chamada interrompe o fluxo.
    const fail: (message: string, variant?: "error" | "warning") => never = (message, variant = "error") => {
      setError(message);
      toast(message, variant);
      throw Object.assign(new Error(message), { handled: true });
    };

    const payloadAny = payload as unknown as Record<string, any>;

    // 1. O candidato vem primeiro: `interviews.candidate_id` é o vínculo de verdade desde a
    //    migração 20260914210000, então o candidato precisa existir antes da entrevista.
    let candidateId: string | null = null;
    // Disponibilidade só existe se alguém marcou obras. `worksite_type: "all"` era um campo
    // fantasma do parecer — sem tela para preencher — que carimbava "Todas as Obras" em
    // quem nunca declarou nada (QA B3).
    const disponibilidadeInformada: string[] = Array.isArray(assessmentData.available_worksites)
      ? (assessmentData.available_worksites as string[])
      : [];
    if (payloadAny.candidate_name) {
      const parts = payloadAny.candidate_name.split(" ");
      const tag = payloadAny.destination || (payloadAny.result === "Aprovado" ? "Aprovado na Entrevista" : payloadAny.result === "Reprovado" ? "Reprovado na Entrevista" : "Entrevistado");

      // Quem é esta pessoa: e-mail de verdade, depois CPF, depois telefone. Antes era
      // `upsert onConflict: email` com um e-mail derivado do primeiro nome — dois homônimos
      // sem e-mail viravam o mesmo cadastro (issue #76).
      const identidade = { email: payloadAny.email, cpf: formData.cpf, phone: payloadAny.phone };
      const existente = await findExistingCandidateId(supabase, identidade);
      const dadosDoCandidato = {
        full_name: payloadAny.candidate_name,
        first_name: parts[0] || "",
        last_name: parts.slice(1).join(" ") || "",
        email: hasRealEmail(payloadAny.email) ? payloadAny.email : undefined,
        phone: payloadAny.phone,
        role_interest: payloadAny.role,
        city: assessmentData.worksite || "",
        // Só grava disponibilidade que alguém informou. O padrão do parecer marcava
        // "Todas as Obras" em todo candidato (QA B3) e, sem a chave condicional abaixo,
        // o salvamento passaria a apagar a disponibilidade real de quem já tinha uma.
        ...(disponibilidadeInformada.length > 0 ? { available_worksites: disponibilidadeInformada } : {}),
        search_tags: [tag, assessmentData.selection_stage || "Importado de Entrevistas"].filter(Boolean),
        birth_date: formData.birth_date || null,
        cpf: formData.cpf || null,
        marital_status: formData.marital_status || null,
        birthplace: formData.birthplace || null,
        gender_identity: formData.gender_identity || null,
        sexual_orientation: formData.sexual_orientation || null,
        race_declaration: formData.race_declaration || null,
        salary_expectation: formData.salary_expectation || null,
        has_cnh: formData.has_cnh ?? null,
        cnh_categories: formData.cnh_categories ? [formData.cnh_categories] : [],
        languages: formData.languages || null,
        has_dependents: formData.has_dependents ?? null,
        dependents_count: formData.dependents_count ?? null,
        dependents_notes: formData.dependents_notes || null,
        uniform_size: formData.uniform_size || null,
        boot_size: formData.boot_size || null
      };
      // `email` é NOT NULL UNIQUE: quem não informou ganha uma chave própria, nunca
      // uma derivada do nome. Num cadastro que já existe, o e-mail atual é preservado.
      const semEmail = dadosDoCandidato.email === undefined;

      if (existente) {
        const { error: updateError } = await supabase
          .from("candidates")
          .update(semEmail ? { ...dadosDoCandidato, email: undefined } : dadosDoCandidato)
          .eq("id", existente);
        if (updateError) console.error("Erro ao atualizar candidato:", updateError);
        else candidateId = existente;
      } else {
        const { data: inserido, error: insertError } = await supabase
          .from("candidates")
          .insert({
            ...dadosDoCandidato,
            email: semEmail ? placeholderEmail(payloadAny.candidate_name) : dadosDoCandidato.email,
          })
          .select("id")
          .single();
        if (insertError) console.error("Erro ao enviar para candidatos:", insertError);
        else if (inserido) candidateId = inserido.id;
      }
    }

    // 2. Trocar a vaga de uma entrevista salva apagaria o registro (e o parecer) da vaga
    //    anterior. Outra vaga é outra entrevista — o usuário decide na hora.
    let alvoId = editingId;
    if (roleChangedOnSavedInterview(editingId, form.role, payloadAny.role)) {
      const criarNova = window.confirm(
        `A vaga mudou de "${form.role}" para "${payloadAny.role}".` +
        "\n\nOK = registrar como entrevista NOVA (a anterior fica no histórico)." +
        "\nCancelar = alterar a entrevista atual."
      );
      if (criarNova) alvoId = null;
    }

    // 3. A entrevista em si.
    const interviewPayload = { ...payload, candidate_id: candidateId };
    let savedInterviewId = alvoId;

    if (alvoId) {
      let query = supabase.from("interviews").update(interviewPayload).eq("id", alvoId);
      if (currentUpdatedAt) {
        query = query.eq("updated_at", currentUpdatedAt);
      }
      const { data, error: saveError } = await query.select("id");

      if (saveError) fail("Erro ao atualizar entrevista: " + saveError.message);
      else if (!data || data.length === 0) fail("Conflito: A entrevista foi modificada por outro usuário. Por favor, cancele e abra novamente.");
    } else {
      const { data, error: saveError } = await supabase.from("interviews").insert(interviewPayload).select("id").single();
      if (saveError) fail("Erro ao salvar entrevista: " + saveError.message);
      else savedInterviewId = data.id;
    }

    if (savedInterviewId) {
      const { data: assessment, error: assessmentError } = await supabase
        .from("interview_assessments")
        .upsert({ interview_id: savedInterviewId }, { onConflict: "interview_id" })
        .select("id")
        .single();
      // A entrevista já gravou aqui: falha do parecer é salvamento parcial (amarelo).
      if (assessmentError || !assessment) fail("Entrevista salva, mas o parecer não: " + (assessmentError?.message || "avaliação não encontrada."), "warning");
      const values = assessmentToRows({ ...assessmentForm, ...assessmentData }).map((value) => ({ ...value, assessment_id: assessment.id }));
      // Só apaga quando há linhas novas para gravar — parecer vazio zerava o que existia.
      if (values.length) {
        const { error: clearError } = await supabase.from("interview_assessment_values").delete().eq("assessment_id", assessment.id);
        const { error: valuesError } = clearError ? { error: clearError } : await supabase.from("interview_assessment_values").insert(values);
        if (clearError || valuesError) fail("Entrevista salva, mas o parecer não: " + (clearError || valuesError)!.message, "warning");
      }
    }

    toast("Parecer e entrevista salvos com sucesso.", "success");

    // 4. Histórico do candidato: entrevista nova ou mudança de situação vira linha própria,
    //    para que a situação anterior não se perca ao sobrescrever `interviews`.
    if (candidateId) {
      const novaSituacao = {
        status: payloadAny.status,
        result: payloadAny.result,
        destination: payloadAny.destination || "",
      };
      const situacaoAnterior = { status: form.status, result: form.result, destination: form.destination };
      if (!alvoId || interviewProgressChanged(situacaoAnterior, novaSituacao)) {
        const { error: historyError } = await supabase.from("candidate_interviews").insert({
          candidate_id: candidateId,
          stage: interviewHistoryStage(novaSituacao),
          workplace_name: assessmentData.worksite || null,
          interviewer_name: currentUserName || null,
          notes: `[Entrevista] ${payloadAny.role || "Vaga não informada"} — ${formatInterviewSchedule(payloadAny.interview_date, payloadAny.interview_time)} · Situação: ${novaSituacao.status} · Resultado: ${novaSituacao.result}${novaSituacao.destination ? ` · Destino: ${novaSituacao.destination}` : ""}`,
        });
        if (historyError) console.error("Erro ao gravar histórico da entrevista:", historyError.message);
      }
    }

    setIsModalOpen(false);
    loadInterviews();
    return candidateId ?? undefined;
  };
  
  // Aplica no formulário o currículo lido — pelo parser local ou pela IA.
  const openNewModal = () => {
    setEditingId(null);
    setCurrentUpdatedAt(null);
    setForm({ candidate_name: "", role: "", phone: "", email: "", interview_date: "", interview_time: "", status: "Aguardando", result: "N/C", destination: "" });
    setAssessmentForm(defaultAssessment);
    setIsModalOpen(true);
  };
  
  // Mesma pessoa, outra vaga: registro novo (com parecer próprio), nunca por cima do antigo.
  const openNewInterviewFor = (interview: Interview) => {
    setEditingId(null);
    setCurrentUpdatedAt(null);
    setForm({
      candidate_name: interview.candidate_name || "",
      role: "",
      phone: interview.phone || "",
      email: interview.email || "",
      interview_date: "",
      interview_time: "",
      status: "Aguardando",
      result: "N/C",
      destination: "",
    });
    setAssessmentForm(defaultAssessment);
    setIsModalOpen(true);
  };

  const openEditModal = (interview: Interview) => {
    setEditingId(interview.id);
    setCurrentUpdatedAt(interview.updated_at || null);
    setForm({
      candidate_name: interview.candidate_name || "",
      role: interview.role || "",
      phone: interview.phone || "",
      email: interview.email || "",
      interview_date: interview.interview_date || "",
      interview_time: interview.interview_time || "",
      status: interview.status || "Aguardando",
      result: interview.result || "N/C",
      destination: interview.destination || "",
    });
    setAssessmentForm(interview.assessment || defaultAssessment);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Tem certeza que deseja excluir esta entrevista definitivamente?")) return;
    const supabase = createClient();
    const { error: delError } = await supabase.from("interviews").delete().eq("id", id);
    if (delError) {
      alert("Erro ao excluir entrevista: " + delError.message);
      return;
    }
    setInterviews((prev) => prev.filter((i) => i.id !== id));
    if (editingId === id) setIsModalOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance">Registro de Entrevistas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerenciamento de candidatos, avaliações e pareceres.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportToCsv} disabled={filtered.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
            <Button onClick={openNewModal} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Entrevista
            </Button>
          </div>
        </header>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
          <Metric icon={CalendarClock} label="Hoje" value={agendaHoje.length} />
          <Metric icon={User} label="Total Registros" value={filtered.length} />
          <Metric icon={Calendar} label="Confirmados" value={confirmados} />
          <Metric icon={CheckCircle2} label="Compareceram" value={compareceram} />
          <Metric icon={CheckCircle2} label="Aprovados" value={aprovados} />
        </div>

        {agenda.length > 0 && (
          <div className="rounded-xl border bg-card">
            <div className="flex items-center gap-2 border-b p-4 font-semibold">
              <CalendarClock className="h-4 w-4 text-primary" />
              Próximas entrevistas
              <span className="text-xs font-normal text-muted-foreground">(hoje e próximos 7 dias)</span>
            </div>
            <ul className="divide-y">
              {agenda.slice(0, 8).map((i) => (
                <li
                  key={i.id}
                  onClick={() => openEditModal(i)}
                  className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm hover:bg-muted/30"
                >
                  <span className={`font-medium ${i.interview_date === hojeISO ? "text-primary" : "text-foreground"}`}>
                    {i.interview_date === hojeISO ? "Hoje" : new Date(i.interview_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    {i.interview_time ? ` ${i.interview_time}` : ""}
                  </span>
                  <span className="font-medium">{i.candidate_name || "Sem nome"}</span>
                  <span className="text-muted-foreground">{i.role || "Vaga não informada"}</span>
                  <span className={`ml-auto inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${statusStyle[i.status || ""] || "bg-muted text-muted-foreground"}`}>
                    {i.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar candidato, cargo, status..."
              className="pl-9 bg-muted/30 border-border/50 h-10 text-sm rounded-md"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Mês:</span>
            <Input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)} 
              className="h-10 w-44 bg-muted/30 border-border/50"
            />
            {selectedMonth && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedMonth("")} className="text-xs text-muted-foreground">
                Limpar
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left align-top">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-muted-foreground font-medium">
                  <th className="px-4 py-3">Candidato</th>
                  <th className="px-4 py-3">Cargo Alvo</th>
                  <th className="px-4 py-3">Data / Hora</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Resultado</th>
                  <th className="px-4 py-3">Destino</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading && (
                  <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>Carregando entrevistas...</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>Nenhum registro encontrado.</td></tr>
                )}
                {!loading && filtered.map((interview) => (
                  <tr key={interview.id} onClick={() => openEditModal(interview)} className="hover:bg-muted/30 cursor-pointer transition-colors group">
                    <td className="px-4 py-3 min-w-64">
                      <div className="font-medium text-foreground">{interview.candidate_name || "Sem nome"}</div>
                      <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                        {interview.phone && <div>{interview.phone}</div>}
                        {interview.email && <div>{interview.email}</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3 min-w-44 font-medium text-muted-foreground">
                      {interview.role || "Não informado"}
                    </td>
                    <td className="px-4 py-3 min-w-36 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {interview.interview_date ? new Date(interview.interview_date).toLocaleDateString("pt-BR", {timeZone: "UTC"}) : "N/D"}
                      </div>
                      {interview.interview_time && (
                        <div className="flex items-center gap-1.5 mt-1 text-xs">
                          <Clock className="h-3.5 w-3.5" />
                          {interview.interview_time}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-36">
                       <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusStyle[interview.status || ""] || "bg-muted text-muted-foreground"}`}>
                         {interview.status || "N/A"}
                       </span>
                    </td>
                    <td className="px-4 py-3 min-w-36 font-medium">
                       <span className={resultStyle[interview.result || ""] || ""}>
                         {interview.result || "-"}
                       </span>
                    </td>
                    <td className="px-4 py-3 min-w-36">
                       {interview.destination ? (
                         <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${destinationStyle[interview.destination] || "bg-muted text-muted-foreground"}`}>
                           {interview.destination}
                         </span>
                       ) : (
                         <span className="text-muted-foreground">-</span>
                       )}
                       {interview.candidate_id && stageByCandidate[interview.candidate_id] && (
                         <div className="mt-1 text-xs text-muted-foreground">
                           Etapa: {stageByCandidate[interview.candidate_id]}
                         </div>
                       )}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openNewInterviewFor(interview)}
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Nova entrevista para outra vaga"
                      >
                        <CalendarPlus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDelete(interview.id, e)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Excluir entrevista"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Entrevista */}
      {/* Modal Nova/Editar Entrevista */}
      {isModalOpen && (
        <CandidateProfileModal 
          interviewId={editingId || null}
          initialData={!editingId ? {
            full_name: form.candidate_name,
            email: form.email,
            phone: form.phone,
            role_interest: form.role,
            ...assessmentForm
          } : undefined}
          initialAssessmentData={!editingId ? assessmentForm : undefined}
          interviewProgress={{ status: form.status, result: form.result, destination: form.destination, interview_date: form.interview_date, interview_time: form.interview_time }}
          startLocked={!editingId}
          isEditable={true}
          defaultEditMode={true}
          canSaveAssessment={true}
          onClose={() => setIsModalOpen(false)}
          onSave={handleModalSave}
        />
      )}


      {/* Modal Gerenciar Chaves de IA */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background w-full max-w-xl rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-lg font-semibold">Provedores de IA</h2>
                <p className="text-sm text-muted-foreground">Selecione o provedor e insira sua chave para utilizar na análise.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsKeyModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-4 space-y-6 max-h-[60vh] overflow-y-auto">
              {providers.map(provider => (
                <div key={provider.id} className="p-4 border rounded-lg bg-muted/10 space-y-4 relative">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{provider.name}</h3>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id={`active-${provider.id}`} 
                        checked={provider.isActive}
                        onCheckedChange={(checked) => updateProvider(provider.id, { isActive: Boolean(checked) })}
                      />
                      <Label htmlFor={`active-${provider.id}`} className="cursor-pointer">Ativo</Label>
                    </div>
                  </div>
                  
                  {provider.id !== "gemini" && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">Base URL</Label>
                        <Input 
                          value={provider.baseUrl} 
                          onChange={(e) => updateProvider(provider.id, { baseUrl: e.target.value })} 
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">API Key</Label>
                        <Input 
                          type="password"
                          value={provider.apiKey} 
                          onChange={(e) => updateProvider(provider.id, { apiKey: e.target.value })} 
                          className="h-8 text-xs"
                          placeholder="Cole sua chave aqui..."
                        />
                      </div>
                    </>
                  )}
                  {provider.id === "gemini" && (
                    <p className="text-xs text-muted-foreground">Utiliza a chave NEXT_PUBLIC_GEMINI_API_KEY do sistema.</p>
                  )}
                  
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Modelo Selecionado</Label>
                      {provider.models.length > 0 ? (
                        <select 
                          className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={provider.selectedModel}
                          onChange={(e) => updateProvider(provider.id, { selectedModel: e.target.value })}
                        >
                          {provider.models.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="h-8 px-3 py-1 text-xs border rounded-md bg-muted/30 text-muted-foreground flex items-center">
                          {provider.selectedModel || "Nenhum modelo selecionado"}
                        </div>
                      )}
                    </div>
                    <Button variant="secondary" className="h-8 text-xs" onClick={() => fetchModels(provider.id)}>
                      Buscar Modelos
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end p-4 border-t gap-2 bg-muted/10">
              <Button onClick={() => setIsKeyModalOpen(false)}>Concluir</Button>
            </div>
          </div>
        </div>
      )}

      {viewingCandidateProfile && (
        <CandidateProfileModal 
          interviewId={viewingCandidateProfile.interviewId}
          email={viewingCandidateProfile.email}
          candidateName={viewingCandidateProfile.name}
          onClose={() => setViewingCandidateProfile(null)}
        />
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Briefcase; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      {/* O cartão tem largura mínima na grade e o rótulo quebra em duas linhas: antes ele
          estourava a borda e saía cortado ("Total Registr", "Confir"). */}
      <div className="min-w-0">
        <p className="text-xs leading-tight text-muted-foreground break-words">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}
