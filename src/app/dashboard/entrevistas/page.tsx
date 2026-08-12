"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { Check, Search, Filter, Loader2, Key, Download, MapPin, Briefcase, Calendar, Clock, Trash2, Phone, Mail, User, LogOut, Shield, ChevronDown, CheckCircle2, ChevronRight, X, FileText, ArrowRight, Printer, AlertTriangle, MessageSquare, Plus, FileUp } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CandidateProfileModal } from "@/components/CandidateProfileModal";
import { itemsToText, parseSolidesResume, type ParsedResume } from "@/lib/resumeParser";

// O parser local devolve ParsedResume; a IA devolve os mesmos campos mais alguns
// que só ela consegue inferir do texto livre.
type ParsedResumeFields = Partial<ParsedResume> & {
  is_internal?: boolean;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  has_dependents?: boolean;
  dependents_count?: number;
  dependents_notes?: string;
  uniform_size?: string;
  boot_size?: string;
};

// Define a versão para baixar o worker correto do CDN
if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

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
  psychological_test: string;
  tests_details?: string;
  tests_list?: PsychologicalTestInput[];
  academic_list?: AcademicRecord[];
  experience_list?: ProfessionalExperienceRecord[];
  age?: string | number;
  education?: string;
  technical: string;
  communication: string;
  cultural_fit: string;
  strengths: string;
  weaknesses: string;
  observations: string;
  worksite?: string;
  worksite_type?: "all" | "specific";
  available_worksites?: string[];
  selection_stage?: string;
  is_internal?: boolean;
  location?: string;
  professional_summary?: string;
  experience_summary?: string;
  cnh?: string;
  cnh_category?: string;
  birth_date?: string;
  cpf?: string;
  gender?: string;
  address?: string;
  marital_status?: string;
  salary_expectation?: string;
  birthplace?: string;
  secondary_phone?: string;
  secondary_email?: string;
  emergency_contact_phone?: string;
  emergency_contact_name?: string;
  has_cnh?: boolean;
  cnh_categories?: string[];
  has_dependents?: boolean;
  dependents_count?: number;
  dependents_notes?: string;
  uniform_size?: string;
  boot_size?: string;
  gender_identity?: string;
  sexual_orientation?: string;
  race_declaration?: string;
  additional_info?: string;
  personal_info?: string;
  diversity_info?: string;
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
  Desistente: "text-zinc-500",
  "N/C": "text-zinc-500",
};

const defaultAssessment: Assessment = {
  psychological_test: "Não",
  tests_details: "",
  tests_list: [],
  academic_list: [],
  experience_list: [],
  age: "",
  education: "Ensino Médio",
  technical: "",
  communication: "",
  cultural_fit: "",
  strengths: "",
  weaknesses: "",
  observations: "",
  worksite: "",
  worksite_type: "all",
  available_worksites: [],
  selection_stage: "",
  is_internal: false,
  location: "",
  professional_summary: "",
  experience_summary: "",
  cnh: "",
  cnh_category: "",
  birth_date: "",
  cpf: "",
  gender: "",
  address: "",
  marital_status: "",
  salary_expectation: "",
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
  { id: "gemini", name: "Gemini (Sistema)", baseUrl: "https://generativelanguage.googleapis.com/v1beta", apiKey: "", isActive: true, models: [], selectedModel: "gemini-2.5-flash" },
  { id: "9router", name: "9router", baseUrl: "https://rk9xyun.abc-tunnel.us/v1", apiKey: "", isActive: false, models: [], selectedModel: "" },
  { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", apiKey: "", isActive: false, models: [], selectedModel: "" },
  { id: "opencode", name: "Opencode", baseUrl: "https://api.opencode.com/v1", apiKey: "", isActive: false, models: [], selectedModel: "" },
  { id: "nvidia", name: "Nvidia NIM", baseUrl: "https://integrate.api.nvidia.com/v1", apiKey: "", isActive: false, models: [], selectedModel: "nvidia/nemotron-3-ultra-550b-a55b" },
];

// gemini-1.5-flash foi descontinuado na API; 2.5-flash e estavel.
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

async function generateTestText(testName: string, classification: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  const prompt = `Escreva um parágrafo curto e profissional de parecer psicológico para um candidato de emprego. O teste realizado foi '${testName}' e o resultado obtido foi '${classification}'. Não invente características adicionais, apenas explique o que esse resultado significa nesse teste específico em 2 a 3 linhas de forma objetiva.`;

  if (apiKey) {
    try {
      const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      if (!res.ok) {
        console.error("Gemini error:", res.status, await res.text());
        return "";
      }
      const data = await res.json();
      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }
    } catch (e) {
      console.error("Erro na API do Gemini, usando fallback:", e);
    }
  }

  const levels: any = {
    "Superior": "acima da média, demonstrando excelente capacidade",
    "Médio Superior": "ligeiramente acima da média, demonstrando boa capacidade",
    "Médio": "dentro do esperado para a população geral, demonstrando capacidade adequada",
    "Médio Inferior": "abaixo da média, sugerindo alguma dificuldade",
    "Inferior": "significativamente abaixo da média, indicando dificuldade acentuada"
  };

  const levelText = levels[classification] || "com desempenho compatível com a classificação " + classification;

  switch (testName) {
    case "G36":
      return `No teste G36 (Raciocínio Lógico e Inteligência Não-Verbal), o candidato obteve classificação ${classification}. O resultado indica que o mesmo apresenta uma capacidade de raciocínio abstrato e resolução de problemas ${levelText}.`;
    case "TEALT":
      return `Na avaliação pelo TEALT (Teste de Atenção Alternada), o candidato apresentou classificação ${classification}. Isto sugere que sua capacidade de alternar o foco entre diferentes tarefas ou estímulos está ${levelText}.`;
    case "TEADI":
      return `No TEADI (Teste de Atenção Dividida), o candidato alcançou a classificação ${classification}. O resultado aponta que sua habilidade para dividir a atenção em mais de um estímulo simultâneo está ${levelText}.`;
    case "TEACO-FF":
      return `Submetido ao TEACO-FF (Teste de Atenção Concentrada), o candidato demonstrou classificação ${classification}. Evidencia-se que sua aptidão para manter o foco em tarefas sob pressão ou rotineiras encontra-se ${levelText}.`;
    case "NEO PI-R":
    case "NEO FFI":
      return `O inventário de personalidade ${testName} indicou que o candidato apresenta traços predominantemente em nível ${classification} nos fatores avaliados, sugerindo características comportamentais que requerem análise de adequação à vaga.`;
    default:
      return `No teste ${testName}, o candidato apresentou classificação ${classification}, indicando um desempenho compatível com este nível de aptidão.`;
  }
}


const TEST_OPTIONS: Record<string, { table_name: string; demographic_type?: string; demographic_value?: string; label: string }[]> = {
  "TEADI": [
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Geral",
      "demographic_value": "Geral",
      "label": "População Geral - Brasil"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Idade",
      "demographic_value": "Até 25 anos",
      "label": "População Geral - Brasil (Até 25 anos) - Idade"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Idade",
      "demographic_value": "26 a 33 anos",
      "label": "População Geral - Brasil (26 a 33 anos) - Idade"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Idade",
      "demographic_value": "34 a 39 anos",
      "label": "População Geral - Brasil (34 a 39 anos) - Idade"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Idade",
      "demographic_value": "40 a 46 anos",
      "label": "População Geral - Brasil (40 a 46 anos) - Idade"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Idade",
      "demographic_value": "47 anos ou mais",
      "label": "População Geral - Brasil (47 anos ou mais) - Idade"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Escolaridade",
      "demographic_value": "Ensino Fundamental",
      "label": "População Geral - Brasil (Ensino Fundamental) - Escolaridade"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Escolaridade",
      "demographic_value": "Ensino Médio",
      "label": "População Geral - Brasil (Ensino Médio) - Escolaridade"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Escolaridade",
      "demographic_value": "Superior",
      "label": "População Geral - Brasil (Superior) - Escolaridade"
    }
  ],
  "TEALT": [
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Geral",
      "demographic_value": "Geral",
      "label": "População Geral - Brasil"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Idade",
      "demographic_value": "Até 22 anos",
      "label": "População Geral - Brasil (Até 22 anos) - Idade"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Idade",
      "demographic_value": "23 a 30 anos",
      "label": "População Geral - Brasil (23 a 30 anos) - Idade"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Idade",
      "demographic_value": "31 a 37 anos",
      "label": "População Geral - Brasil (31 a 37 anos) - Idade"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Idade",
      "demographic_value": "38 a 44 anos",
      "label": "População Geral - Brasil (38 a 44 anos) - Idade"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Idade",
      "demographic_value": "45 anos ou mais",
      "label": "População Geral - Brasil (45 anos ou mais) - Idade"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Escolaridade",
      "demographic_value": "Ensino Fundamental",
      "label": "População Geral - Brasil (Ensino Fundamental) - Escolaridade"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Escolaridade",
      "demographic_value": "Ensino Médio",
      "label": "População Geral - Brasil (Ensino Médio) - Escolaridade"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Escolaridade",
      "demographic_value": "Superior",
      "label": "População Geral - Brasil (Superior) - Escolaridade"
    }
  ],
  "TEACO-FF": [
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Geral",
      "demographic_value": "Geral",
      "label": "População Geral - Brasil"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Idade",
      "demographic_value": "18 a 19 anos",
      "label": "População Geral - Brasil (18 a 19 anos) - Idade"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Idade",
      "demographic_value": "20 a 29 anos",
      "label": "População Geral - Brasil (20 a 29 anos) - Idade"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Idade",
      "demographic_value": "30 a 39 anos",
      "label": "População Geral - Brasil (30 a 39 anos) - Idade"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Idade",
      "demographic_value": "40 a 49 anos",
      "label": "População Geral - Brasil (40 a 49 anos) - Idade"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Idade",
      "demographic_value": "50 anos ou mais",
      "label": "População Geral - Brasil (50 anos ou mais) - Idade"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Escolaridade",
      "demographic_value": "Ensino Fundamental",
      "label": "População Geral - Brasil (Ensino Fundamental) - Escolaridade"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Escolaridade",
      "demographic_value": "Ensino Médio",
      "label": "População Geral - Brasil (Ensino Médio) - Escolaridade"
    },
    {
      "table_name": "População Geral - Brasil",
      "demographic_type": "Escolaridade",
      "demographic_value": "Superior",
      "label": "População Geral - Brasil (Superior) - Escolaridade"
    },
    {
      "table_name": "Tabela 43. População Geral - Brasil",
      "label": "Tabela 43. População Geral - Brasil"
    },
    {
      "table_name": "Tabela 44. População Geral - Brasil (Ensino Fundamental)",
      "label": "Tabela 44. População Geral - Brasil (Ensino Fundamental)"
    },
    {
      "table_name": "Tabela 44. População Geral - Brasil (Ensino Médio)",
      "label": "Tabela 44. População Geral - Brasil (Ensino Médio)"
    },
    {
      "table_name": "Tabela 44. População Geral - Brasil (Ensino Superior)",
      "label": "Tabela 44. População Geral - Brasil (Ensino Superior)"
    },
    {
      "table_name": "Tabela 55. População Geral - São Paulo",
      "label": "Tabela 55. População Geral - São Paulo"
    }
  ],
  "NEO PI-R": [
    {
      "table_name": "Geral",
      "demographic_type": "Geral",
      "demographic_value": "Geral",
      "label": "Geral"
    },
    {
      "table_name": "Masculino",
      "demographic_type": "Sexo",
      "demographic_value": "Masculino",
      "label": "Masculino - Sexo"
    },
    {
      "table_name": "Feminino",
      "demographic_type": "Sexo",
      "demographic_value": "Feminino",
      "label": "Feminino - Sexo"
    }
  ],
  "NEO FFI-R": [
    {
      "table_name": "Geral",
      "demographic_type": "Geral",
      "demographic_value": "Geral",
      "label": "Geral"
    },
    {
      "table_name": "Masculino",
      "demographic_type": "Sexo",
      "demographic_value": "Masculino",
      "label": "Masculino - Sexo"
    },
    {
      "table_name": "Feminino",
      "demographic_type": "Sexo",
      "demographic_value": "Feminino",
      "label": "Feminino - Sexo"
    }
  ],
  "G36": [
    {
      "table_name": "Tabela 20. Seleção de São Paulo",
      "demographic_type": "Ensino Médio",
      "demographic_value": "",
      "label": "Tabela 20. Seleção de São Paulo - Ensino Médio"
    },
    {
      "table_name": "Tabela 20. Seleção de São Paulo",
      "demographic_type": "Superior",
      "demographic_value": "",
      "label": "Tabela 20. Seleção de São Paulo - Superior"
    },
    {
      "table_name": "Tabela 20. Seleção de São Paulo",
      "demographic_type": "Geral",
      "demographic_value": "",
      "label": "Tabela 20. Seleção de São Paulo"
    }
  ]
};

export default function EntrevistasPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [worksites, setWorksites] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(""); // YYYY-MM
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"dados" | "avaliacao" | "curriculo">("dados");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState<string | null>(null);
  const [form, setForm] = useState({
    candidate_name: "", role: "", phone: "", email: "", interview_date: "", interview_time: "", status: "Aguardando", result: "N/C"
  });
  const [assessmentForm, setAssessmentForm] = useState<Assessment>(defaultAssessment);
  const [movingToTalents, setMovingToTalents] = useState(false);
  
  // Resume Modal State
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [providers, setProviders] = useState<AIProvider[]>(defaultProviders);
  const [resumeText, setResumeText] = useState("");
  const [isAnalyzingResume, setIsAnalyzingResume] = useState(false);
  const [viewingCandidateProfile, setViewingCandidateProfile] = useState<{ interviewId?: string | null; email?: string | null; name?: string | null } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("ai_providers");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure all providers exist
        const merged = defaultProviders.map(dp => {
          const found = parsed.find((p: AIProvider) => p.id === dp.id);
          return found ? { ...dp, ...found, models: found.models || dp.models, selectedModel: found.selectedModel || dp.selectedModel } : dp;
        });
        setProviders(merged);
      } catch (e) {
        console.error("Error loading providers from local storage:", e);
      }
    }
  }, []);

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
        models = (data.models || [])
          .filter((m: any) => m.name.includes("gemini"))
          .map((m: any) => ({ id: m.name.replace("models/", ""), name: m.displayName || m.name }));
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
        const modelsData = data.data || data;
        models = (Array.isArray(modelsData) ? modelsData : []).map((m: any) => ({
          id: m.id, name: m.id
        }));
      }

      if (models.length > 0) {
        updateProvider(providerId, { models, selectedModel: models[0].id });
        alert(`Foram encontrados ${models.length} modelos!`);
      } else {
        alert("Nenhum modelo retornado pela API.");
      }
    } catch (e: any) {
      console.error(e);
      alert(`Falha ao buscar modelos: ${e.message}`);
    }
  };

  const generateWithAI = async (prompt: string): Promise<string> => {
    const activeProvider = providers.find(p => p.isActive) || providers.find(p => p.id === "gemini");
    if (!activeProvider) throw new Error("Nenhum provedor de IA ativo encontrado.");

    if (activeProvider.id === "gemini") {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Chave do Gemini não configurada nas variáveis de ambiente.");
      
      const modelToUse = activeProvider.selectedModel || "gemini-2.5-flash";
      const baseUrl = activeProvider.baseUrl.replace(/\/+$/, "");
      const url = `${baseUrl}/models/${modelToUse}:generateContent?key=${apiKey}`;
      
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erro Gemini (${res.status}): ${errorText}`);
      }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else {
      const baseUrl = activeProvider.baseUrl.replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${activeProvider.apiKey}`,
          "HTTP-Referer": window.location.origin,
          "X-Title": "Gestaopessoas"
        },
        body: JSON.stringify({
          model: activeProvider.selectedModel || "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }]
        })
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erro AI (${res.status}): ${errorText}`);
      }
      const rawText = await res.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        if (rawText.includes("data: ")) {
          let fullText = "";
          const lines = rawText.split('\n');
          for (const line of lines) {
            if (line.trim().startsWith('data: ')) {
              const jsonStr = line.replace('data: ', '').trim();
              if (jsonStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.choices?.[0]?.delta?.content) fullText += parsed.choices[0].delta.content;
                else if (parsed.choices?.[0]?.message?.content) fullText += parsed.choices[0].message.content;
              } catch (err) {}
            }
          }
          if (fullText) return fullText;
        }
        throw new Error("A resposta da IA não é um JSON válido (talvez seja um erro de conexão/proxy). " + String(e));
      }
      return data.choices?.[0]?.message?.content || "";
    }
  };
  
  // Test generation states
  const [selectedTest, setSelectedTest] = useState("G36");
  const [selectedClass, setSelectedClass] = useState("Médio");
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);

  const handleGenerateTestText = async () => {
    setIsGeneratingTest(true);
    const supabase = createClient();
    
    let combinedResults = "";
    const list = assessmentForm.tests_list || [];
    
    for (const test of list) {
      if (test.test_name.includes("NEO")) {
        const factors = test.factors || {};
        let neoResults = `${test.test_name}:\n`;
        for (const [f, score] of Object.entries(factors)) {
          if (!score) continue;
          const numScore = Number(score);
          const { data } = await supabase
            .from('psychological_norms')
            .select('*')
            .eq('test_name', test.test_name)
            .eq('table_name', test.table_name || '')
            .eq('demographic_type', test.demographic_type || '')
            .eq('demographic_value', test.demographic_value || '')
            .eq('factor', f)
            .lte('min_score', numScore)
            .gte('max_score', numScore)
            .limit(1);
          const classification = data?.[0]?.classification || "Não classificado (Tabela não encontrada)";
          neoResults += `- Fator ${f}: Pontuação ${score} -> ${classification}\n`;
        }
        combinedResults += neoResults + "\n";
      } else {
        if (!test.score) continue;
        const numScore = Number(test.score);
        const { data } = await supabase
          .from('psychological_norms')
          .select('*')
          .eq('test_name', test.test_name)
          .eq('table_name', test.table_name || '')
          .eq('demographic_type', test.demographic_type || '')
          .eq('demographic_value', test.demographic_value || '')
          .lte('min_score', numScore)
          .gte('max_score', numScore)
          .limit(1);
        
        const classification = data?.[0]?.classification || "Não classificado (Tabela não encontrada)";
        combinedResults += `${test.test_name}: Pontuação ${test.score} -> ${classification}\n\n`;
      }
    }
    
    if (combinedResults.trim() !== "") {
      const prompt = `O candidato de ${assessmentForm.age || 'idade não informada'} anos, escolaridade ${assessmentForm.education || 'não informada'}, realizou os seguintes testes psicológicos:\n${combinedResults}\nEscreva um parecer psicológico consolidado e profissional, em um parágrafo objetivo, explicando as características do candidato com base nessas classificações. O parecer deve focar estritamente nas classificações (inferior, médio, superior, etc) e no que elas significam.`;
      
      try {
        const generatedText = await generateWithAI(prompt);
        if (generatedText) {
          setAssessmentForm({ ...assessmentForm, tests_details: "RESULTADOS DA AVALIAÇÃO:\n" + combinedResults + "\nPARECER INTEGRADO DA IA:\n" + generatedText });
        } else {
          setAssessmentForm({ ...assessmentForm, tests_details: "Erro ao comunicar com IA. Resultados brutos:\n" + combinedResults });
        }
      } catch (e) {
        setAssessmentForm({ ...assessmentForm, tests_details: "Erro ao comunicar com IA. Resultados brutos:\n" + combinedResults });
      }
    } else {
      setAssessmentForm({ ...assessmentForm, tests_details: "Resultados consultados (Sem testes válidos):\n" + combinedResults });
    }
    setIsGeneratingTest(false);
  };

  const loadInterviews = async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data, error }, { data: profilesData }, { data: workplacesData }] = await Promise.all([
      supabase.from("interviews").select("*").order("interview_date", { ascending: false, nullsFirst: false }),
      supabase.from("job_profiles").select("title"),
      supabase.from("workplaces").select("name").order("name")
    ]);

    setLoading(false);
    if (error) {
      setError("Não foi possível carregar as entrevistas.");
      return;
    }
    setInterviews((data ?? []) as Interview[]);
    if (profilesData) {
      const allRoles = [...profilesData.map(r => r.title), ...((data ?? []).map((i: any) => i.role))].filter(Boolean);
      const uniqueRoles = Array.from(new Set(allRoles)).sort();
      setRoles(uniqueRoles);
    }
    if (workplacesData) {
      setWorksites(workplacesData.map((w: { name: string }) => w.name));
    }
  };

  useEffect(() => {
    loadInterviews();
  }, []);

  // B1: fecha modais com ESC (modais handrolled sem handler)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsModalOpen(false);
        setIsResumeModalOpen(false);
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

  const confirmados = filtered.filter((i) => i.status === "Confirmado").length;
  const compareceram = filtered.filter((i) => i.status === "Compareceu" || i.result === "Aprovado" || i.result === "Reprovado").length;
  const aprovados = filtered.filter((i) => i.result === "Aprovado").length;

  const exportToCsv = () => {
    if (filtered.length === 0) return;
    const headers = ["Candidato", "Telefone", "Email", "Cargo Alvo", "Data", "Hora", "Status", "Resultado"];
    const rows = filtered.map(i => [
      `"${i.candidate_name || ''}"`, 
      `"${i.phone || ''}"`, 
      `"${i.email || ''}"`, 
      `"${i.role || ''}"`, 
      `"${i.interview_date ? new Date(i.interview_date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : ''}"`, 
      `"${i.interview_time || ''}"`, 
      `"${i.status || ''}"`, 
      `"${i.result || ''}"`
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
  
  const exportParecer = () => {
    const text = `PARECER DE ENTREVISTA
=============================
Candidato: ${form.candidate_name || "N/I"}
Cargo Alvo: ${form.role || "N/I"}
Data: ${form.interview_date ? new Date(form.interview_date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'N/I'}

AVALIAÇÃO
=============================
Teste Psicológico Realizado? ${assessmentForm.psychological_test}
Avaliação Técnica: ${assessmentForm.technical || '-'}
Comunicação: ${assessmentForm.communication || '-'}
Fit Cultural: ${assessmentForm.cultural_fit || '-'}

PONTOS FORTES
-----------------------------
${assessmentForm.strengths || 'Nenhum registrado'}

PONTOS A DESENVOLVER
-----------------------------
${assessmentForm.weaknesses || 'Nenhum registrado'}

PARECER FINAL / OBSERVAÇÕES
-----------------------------
${assessmentForm.observations || 'Nenhum registrado'}

Resultado Final: ${form.result || "N/C"}
`.trim();

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Parecer_${form.candidate_name?.replace(/\s+/g, '_') || 'candidato'}.txt`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printParecer = () => {
    const candidate = form.candidate_name || 'N/I';
    const role = form.role || 'N/I';
    const date = form.interview_date ? new Date(form.interview_date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'N/I';
    const result = form.result || 'N/C';
    const resultColor = result === 'Aprovado' ? '#16a34a' : result === 'Reprovado' ? '#dc2626' : '#d97706';

    const fortes = (assessmentForm.strengths || '').split(',').map(s => s.trim()).filter(Boolean);
    const fracos = (assessmentForm.weaknesses || '').split(',').map(s => s.trim()).filter(Boolean);

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Parecer de Entrevista - ${candidate}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f8fafc; color: #1e293b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { max-width: 800px; margin: 0 auto; background: #fff; }
    @media print { body { background: #fff; } .page { max-width: 100%; box-shadow: none; border: none; margin: 0; padding: 0; } .no-print { display: none !important; } }
    @media screen { .page { margin: 32px auto; padding: 0; box-shadow: 0 4px 24px rgba(0,0,0,.10); border-radius: 16px; overflow: hidden; } }
    .header { padding: 40px 48px 32px; display: flex; flex-direction: column; align-items: center; text-align: center; border-bottom: 2px solid #e2e8f0; }
    .header img { max-width: 140px; margin-bottom: 20px; }
    .header h1 { font-size: 26px; font-weight: 700; margin-bottom: 4px; color: #0f172a; }
    .header-sub { font-size: 14px; color: #64748b; font-weight: 500; }
    .result-badge { display: inline-block; margin-top: 20px; padding: 6px 18px; border-radius: 999px; font-size: 13px; font-weight: 700; letter-spacing: .5px; background: ${resultColor}15; color: ${resultColor}; border: 1.5px solid ${resultColor}40; }
    .body { padding: 40px 48px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px; }
    .info-item label { font-size: 10px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: #94a3b8; display: block; margin-bottom: 4px; }
    .info-item span { font-size: 15px; font-weight: 500; color: #1e293b; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #6366f1; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px; }
    .eval-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .eval-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; }
    .eval-card label { font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #94a3b8; display: block; margin-bottom: 6px; }
    .eval-card span { font-size: 14px; font-weight: 600; color: #1e293b; }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; }
    .tag { padding: 5px 14px; border-radius: 999px; font-size: 13px; font-weight: 500; }
    .tag-green { background: #dcfce7; color: #15803d; }
    .tag-orange { background: #ffedd5; color: #c2410c; }
    .observations { background: #f8fafc; border-left: 4px solid #6366f1; border-radius: 0 8px 8px 0; padding: 18px 20px; font-size: 14px; line-height: 1.8; color: #334155; white-space: pre-wrap; }
    .footer { background: #f1f5f9; padding: 20px 48px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #94a3b8; }
    .print-btn { position: fixed; bottom: 32px; right: 32px; background: #6366f1; color: #fff; border: none; border-radius: 12px; padding: 14px 28px; font-family: inherit; font-size: 15px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 16px rgba(99,102,241,.4); display: flex; align-items: center; gap: 8px; }
    .print-btn:hover { background: #4f46e5; }
    .psy { display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; background: ${assessmentForm.psychological_test === 'Sim' ? '#dcfce7' : '#fee2e2'}; color: ${assessmentForm.psychological_test === 'Sim' ? '#15803d' : '#dc2626'}; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <img src="/logos/SEDE.png" alt="ACPO" />
    <h1>${candidate}</h1>
    <div class="header-sub">Parecer de Entrevista · ${role}</div>
    <div class="result-badge">Resultado: ${result}</div>
  </div>
  <div class="body">
    <div class="info-grid">
      <div class="info-item"><label>Data da Entrevista</label><span>${date}</span></div>
      <div class="info-item"><label>Cargo</label><span>${role}</span></div>
      <div class="info-item"><label>Telefone</label><span>${form.phone || '—'}</span></div>
      <div class="info-item"><label>E-mail</label><span>${form.email || '—'}</span></div>
    </div>

    ${(assessmentForm.professional_summary || assessmentForm.experience_summary || (assessmentForm.academic_list && assessmentForm.academic_list.length > 0) || (assessmentForm.experience_list && assessmentForm.experience_list.length > 0)) ? `
    <div class="section">
      <div class="section-title">Resumo Curricular / Formação & Experiências</div>
      ${assessmentForm.professional_summary ? `<div style="margin-bottom:12px"><b>Resumo Profissional:</b><p style="font-size:13px;margin:4px 0;white-space:pre-wrap;color:#475569">${assessmentForm.professional_summary}</p></div>` : ''}
      ${assessmentForm.address ? `<div style="margin-bottom:12px"><b>Endereço:</b><p style="font-size:13px;margin:4px 0;white-space:pre-wrap;color:#475569">${assessmentForm.address}</p></div>` : ''}
      ${assessmentForm.personal_info ? `<div style="margin-bottom:12px"><b>Informações Pessoais:</b><p style="font-size:13px;margin:4px 0;white-space:pre-wrap;color:#475569">${assessmentForm.personal_info}</p></div>` : ''}
      ${assessmentForm.diversity_info ? `<div style="margin-bottom:12px"><b>Diversidade:</b><p style="font-size:13px;margin:4px 0;white-space:pre-wrap;color:#475569">${assessmentForm.diversity_info}</p></div>` : ''}
      ${assessmentForm.additional_info ? `<div style="margin-bottom:12px"><b>Informações Adicionais:</b><p style="font-size:13px;margin:4px 0;white-space:pre-wrap;color:#475569">${assessmentForm.additional_info}</p></div>` : ''}
      ${assessmentForm.academic_list && assessmentForm.academic_list.length > 0 ? `
      <div style="margin-bottom:14px">
        <b style="font-size:13px;color:#334155">Formação Acadêmica & Cursos:</b>
        <div style="margin-top:6px;display:flex;flex-direction:column;gap:8px">
          ${assessmentForm.academic_list.map(ac => `
            <div style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px">
              <div style="font-weight:600;font-size:13px;color:#1e293b">${ac.course || 'Curso não informado'} — <span style="color:#64748b;font-weight:500">${ac.institution || 'Instituição não informada'}</span></div>
              <div style="font-size:12px;color:#64748b;margin-top:2px">Período: ${ac.start_date || 'N/I'} até ${ac.in_progress ? 'Em andamento' : (ac.end_date || 'N/I')}</div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}
      ${assessmentForm.experience_list && assessmentForm.experience_list.length > 0 ? `
      <div style="margin-bottom:12px">
        <b style="font-size:13px;color:#334155">Histórico Profissional & Experiências:</b>
        <div style="margin-top:6px;display:flex;flex-direction:column;gap:10px">
          ${assessmentForm.experience_list.map(ex => `
            <div style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px">
              <div style="display:flex;justify-content:space-between;align-items:baseline">
                <span style="font-weight:600;font-size:13px;color:#1e293b">${ex.role || 'Cargo não informado'} <span style="color:#64748b;font-weight:500">em ${ex.company || 'Empresa não informada'}</span></span>
                <span style="font-size:11px;color:#475569;background:#e2e8f0;padding:2px 8px;border-radius:4px">${ex.start_date || 'N/I'} - ${ex.is_current ? 'Atual / Até o momento' : (ex.end_date || 'N/I')}</span>
              </div>
              ${ex.description ? `<p style="font-size:12px;margin:6px 0 0 0;white-space:pre-wrap;color:#475569;line-height:1.4">${ex.description}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>` : (assessmentForm.experience_summary ? `<div><b>Experiência:</b><p style="font-size:13px;margin:4px 0;white-space:pre-wrap;color:#475569">${assessmentForm.experience_summary}</p></div>` : '')}
    </div>` : ''}

    <div class="section">
      <div class="section-title">Avaliação</div>
      <div class="eval-grid">
        <div class="eval-card"><label>Avaliação Técnica</label><span>${assessmentForm.technical || '—'}</span></div>
        <div class="eval-card"><label>Comunicação</label><span>${assessmentForm.communication || '—'}</span></div>
        <div class="eval-card"><label>Fit Cultural</label><span>${assessmentForm.cultural_fit || '—'}</span></div>
      </div>
      <div style="margin-top:12px"><label style="font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;display:block;margin-bottom:6px">Teste Psicológico Realizado</label><span class="psy">${assessmentForm.psychological_test || 'Não Informado'}</span></div>
      ${assessmentForm.psychological_test === 'Sim' && assessmentForm.tests_details ? `
      <div style="margin-top:16px">
        <label style="font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;display:block;margin-bottom:6px">Testes Aplicados e Resultados</label>
        <div style="font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">${assessmentForm.tests_details}</div>
      </div>` : ''}
    </div>

    ${fortes.length > 0 ? `
    <div class="section">
      <div class="section-title">Pontos Fortes</div>
      <div class="tags">${fortes.map(f => `<span class="tag tag-green">${f}</span>`).join('')}</div>
    </div>` : ''}

    ${fracos.length > 0 ? `
    <div class="section">
      <div class="section-title">Pontos a Desenvolver</div>
      <div class="tags">${fracos.map(f => `<span class="tag tag-orange">${f}</span>`).join('')}</div>
    </div>` : ''}

    ${assessmentForm.observations ? `
    <div class="section">
      <div class="section-title">Parecer Final</div>
      <div class="observations">${assessmentForm.observations}</div>
    </div>` : ''}
  </div>
  <div class="footer">
    <span>Gerado em ${new Date().toLocaleString('pt-BR')}</span>
    <span>RH · Gestão de Pessoas</span>
  </div>
</div>
<button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.onload = () => win.print();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const supabase = createClient();
    
    const payload = {
      ...Object.fromEntries(
        Object.entries(form).map(([key, value]) => [key, value.trim() || null])
      ),
      assessment: assessmentForm,
      updated_at: new Date().toISOString()
    };
    
    let isSuccess = false;
    
    if (editingId) {
      let query = supabase.from("interviews").update(payload).eq("id", editingId);
      if (currentUpdatedAt) {
        query = query.eq("updated_at", currentUpdatedAt);
      }
      const { data, error: saveError } = await query.select("id");
      
      if (saveError) setError("Erro ao atualizar entrevista: " + saveError.message);
      else if (!data || data.length === 0) setError("Conflito: A entrevista foi modificada por outro usuário. Por favor, cancele e abra novamente.");
      else { isSuccess = true; }
    } else {
      const { error: saveError } = await supabase.from("interviews").insert(payload);
      if (saveError) setError("Erro ao salvar entrevista: " + saveError.message);
      else { isSuccess = true; }
    }
    
    if (isSuccess) {
      // Se Aprovado ou Banco de Talentos, joga pra central do candidato automaticamente
      const payloadAny = payload as any;
      if ((payloadAny.result === "Aprovado" || payloadAny.result === "Banco de Talentos") && payloadAny.candidate_name) {
        const parts = payloadAny.candidate_name.split(" ");
        const tag = payloadAny.result === "Aprovado" ? "Aprovado na Entrevista" : "Banco de Talentos";
        
        const { error: insertError } = await supabase.from("candidates").insert({
          full_name: payloadAny.candidate_name,
          first_name: parts[0] || "",
          last_name: parts.slice(1).join(" ") || "",
          email: payloadAny.email || `${parts[0]?.toLowerCase() || 'candidato'}@sememail.com`,
          phone: payloadAny.phone,
          role_interest: payloadAny.role,
          city: assessmentForm.worksite || "",
          available_worksites: assessmentForm.worksite_type === "all" ? ["Todas as Obras"] : (assessmentForm.available_worksites || []),
          search_tags: [tag, assessmentForm.selection_stage || "Importado de Entrevistas"].filter(Boolean)
        });
        
        if (insertError) {
          console.error("Erro ao enviar para candidatos:", insertError);
        } else {
          alert(`Candidato Movido para a Central do Candidato como ${payloadAny.result}!`);
        }
      }
      setIsModalOpen(false); 
      loadInterviews();
    }
    
    setSaving(false);
  };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "application/pdf") {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const typedarray = new Uint8Array(reader.result as ArrayBuffer);
          const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
          let text = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            // itemsToText separa as colunas do PDF com TAB (a Sólides usa duas
            // colunas nos dados pessoais) e descarta os rodapés "1 / 3".
            text += itemsToText(content.items) + "\n";
          }
          setResumeText(text);
        } catch (err) {
          console.error(err);
          alert("Erro ao extrair texto do PDF. O arquivo pode estar protegido.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (file.type === "text/plain") {
      const reader = new FileReader();
      reader.onload = () => setResumeText(reader.result as string);
      reader.readAsText(file);
    } else {
      alert("Formato não suportado. Por favor, envie um arquivo PDF ou TXT.");
    }
  };

  // Aplica no formulário o currículo lido — pelo parser local ou pela IA.
  const applyParsedResume = (parsed: ParsedResumeFields) => {
    openNewModal();
    setForm(prev => ({
      ...prev,
      candidate_name: parsed.name || "",
      email: parsed.email || "",
      phone: parsed.phone || "",
      role: parsed.role || ""
    }));
    setAssessmentForm(prev => ({
      ...prev,
      age: parsed.age || prev.age,
      location: parsed.location || prev.location,
      is_internal: typeof parsed.is_internal === "boolean" ? parsed.is_internal : prev.is_internal,
      education: parsed.education || prev.education,
      professional_summary: parsed.professional_summary || prev.professional_summary,
      experience_summary: parsed.experience_summary || prev.experience_summary,
      cnh: parsed.cnh || prev.cnh,
      cnh_category: parsed.cnh_category || prev.cnh_category,
      birth_date: parsed.birth_date || prev.birth_date,
      cpf: parsed.cpf || prev.cpf,
      gender: parsed.gender || prev.gender,
      address: parsed.address || prev.address,
      marital_status: parsed.marital_status || prev.marital_status,
      birthplace: parsed.birthplace || prev.birthplace,
      secondary_phone: parsed.secondary_phone || prev.secondary_phone,
      secondary_email: parsed.secondary_email || prev.secondary_email,
      emergency_contact_phone: parsed.emergency_contact_phone || prev.emergency_contact_phone,
      emergency_contact_name: parsed.emergency_contact_name || prev.emergency_contact_name,
      salary_expectation: parsed.salary_expectation || prev.salary_expectation,
      has_cnh: typeof parsed.has_cnh === "boolean" ? parsed.has_cnh : prev.has_cnh,
      cnh_categories: Array.isArray(parsed.cnh_categories) ? parsed.cnh_categories : prev.cnh_categories,
      has_dependents: typeof parsed.has_dependents === "boolean" ? parsed.has_dependents : prev.has_dependents,
      dependents_count: typeof parsed.dependents_count === "number" ? parsed.dependents_count : prev.dependents_count,
      dependents_notes: parsed.dependents_notes || prev.dependents_notes,
      uniform_size: parsed.uniform_size || prev.uniform_size,
      boot_size: parsed.boot_size || prev.boot_size,
      gender_identity: parsed.gender_identity || prev.gender_identity,
      sexual_orientation: parsed.sexual_orientation || prev.sexual_orientation,
      race_declaration: parsed.race_declaration || prev.race_declaration,
      additional_info: parsed.additional_info || prev.additional_info,
      personal_info: parsed.personal_info || prev.personal_info,
      diversity_info: parsed.diversity_info || prev.diversity_info,
      academic_list: Array.isArray(parsed.academic_list) ? parsed.academic_list.map((item, idx) => ({
        id: String(Date.now() + idx),
        course: item.course || "",
        institution: item.institution || "",
        start_date: item.start_date || "",
        end_date: item.end_date || "",
        in_progress: Boolean(item.in_progress)
      })) : prev.academic_list || [],
      experience_list: Array.isArray(parsed.experience_list) ? parsed.experience_list.map((item, idx) => ({
        id: String(Date.now() + 100 + idx),
        role: item.role || "",
        company: item.company || "",
        start_date: item.start_date || "",
        end_date: item.end_date || "",
        is_current: Boolean(item.is_current),
        description: item.description || ""
      })) : prev.experience_list || []
    }));
    setIsResumeModalOpen(false);
  };

  const parseWithoutAI = () => {
    if (!resumeText.trim()) return;
    applyParsedResume(parseSolidesResume(resumeText));
  };

  const analyzeResume = async () => {
    if (!resumeText.trim()) return;
    setIsAnalyzingResume(true);
    
    const prompt = `Extraia os seguintes dados do currículo abaixo e retorne APENAS um JSON válido, sem crases, sem markdown, no formato:
{
  "name": "Nome Completo",
  "email": "Email",
  "phone": "Telefone ou Celular",
  "role": "Cargo ou Objetivo Profissional",
  "age": "Idade (ex: 33 anos) ou Data de Nascimento",
  "location": "Cidade / Estado (ex: Pelotas - RS)",
  "is_internal": false,
  "education": "Escolaridade / Formação Principal",
  "professional_summary": "Resumo profissional completo",
  "cnh": "Possui CNH? (Sim/Não/Não Informado)",
  "cnh_category": "Categoria da CNH (A, B, AB, etc)",
  "birth_date": "Data de nascimento (DD/MM/YYYY)",
  "cpf": "CPF",
  "marital_status": "Estado Civil (Solteiro, Casado, Divorciado, Viúvo, União Estável)",
  "birthplace": "Naturalidade (Cidade/Estado de origem)",
  "address": "Endereço atual completo",
  "secondary_phone": "Telefone secundário",
  "secondary_email": "E-mail secundário",
  "emergency_contact_phone": "Telefone de recado",
  "emergency_contact_name": "Nome do contato de recado",
  "salary_expectation": "Pretensão Salarial",
  "has_cnh": false,
  "cnh_categories": ["B", "D"],
  "has_dependents": false,
  "dependents_count": 0,
  "dependents_notes": "Nomes/idades dos dependentes (filhos, enteados)",
  "uniform_size": "Tamanho de uniforme (PP, P, M, G, GG, XG)",
  "boot_size": "Número da botina",
  "gender_identity": "Autodeclaração de gênero (Homem cis, Mulher cis, Homem trans, Mulher trans, Não-binário, Prefiro não informar)",
  "sexual_orientation": "Orientação sexual (Heterossexual, Homossexual, Bissexual, Pansexual, Prefiro não informar)",
  "race_declaration": "Autodeclaração de raça/cor (Branca, Preta, Parda, Amarela, Indígena, Prefiro não informar)",
  "additional_info": "Informações adicionais do candidato",
  "personal_info": "Informações pessoais do candidato",
  "diversity_info": "Informações de diversidade",
  "salary_expectation": "Pretensão Salarial",

  "academic_list": [
    {
      "id": "1",
      "course": "Nome do Curso ou Graduação",
      "institution": "Nome da Instituição ou Universidade",
      "start_date": "Mês/Ano de Início (ex: 2011 ou 03/2011)",
      "end_date": "Mês/Ano de Conclusão (ex: 2015 ou 12/2015)",
      "in_progress": false
    }
  ],
  "experience_list": [
    {
      "id": "1",
      "role": "Nome do Cargo (ex: Psicólogo Clínico)",
      "company": "Nome da Empresa ou Clínica",
      "start_date": "Mês/Ano Início (ex: 08/2022)",
      "end_date": "Mês/Ano Fim (ex: 05/2024)",
      "is_current": false,
      "description": "Descrição detalhada das atividades e realizações no cargo"
    }
  ],
  "experience_summary": "Histórico de experiência em formato de texto resumido"
}

Currículo:
${resumeText.replace(/Habilidades[\s\S]*?(Idiomas|Informações adicionais|Informações pessoais|Diversidade|Endereço|$)/i, "$1")}`;

    try {
      const generatedText = await generateWithAI(prompt);
      
      let text = generatedText.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(text);

      applyParsedResume(parsed);
    } catch (e: any) {
      console.error(e);
      alert("Falha na Inteligência Artificial: " + (e.message || "A resposta não estava no formato JSON correto."));
    }
    setIsAnalyzingResume(false);
  };

  const moveToTalents = async () => {
    if (!assessmentForm.worksite || !assessmentForm.selection_stage) {
      setError("Para mover, preencha 'Obra / Plantão / Sede' e 'Fase do Processo Seletivo'.");
      return;
    }
    if (!form.candidate_name || !form.email) {
      setError("Candidato precisa de nome e email para ir ao Banco de Talentos.");
      return;
    }
    setMovingToTalents(true);
    setError("");
    const supabase = createClient();
    const parts = form.candidate_name.split(" ");

    const candidateData = {
      full_name: form.candidate_name,
      first_name: parts[0] || "",
      last_name: parts.slice(1).join(" ") || "",
      email: form.email,
      phone: form.phone,
      role_interest: form.role,
      // Usa a cidade/localização real do candidato; worksite é a obra de destino
      city: assessmentForm.location || assessmentForm.worksite,
      available_worksites: assessmentForm.worksite ? [assessmentForm.worksite] : [],
      search_tags: [assessmentForm.selection_stage, "Importado de Entrevistas"].filter(Boolean)
    };

    const { data: inserted, error: insertError } = await supabase
      .from("candidates")
      .insert(candidateData)
      .select("id")
      .single();

    if (insertError) {
      setError("Erro ao enviar para o Banco de Talentos: " + insertError.message);
      setMovingToTalents(false);
      return;
    }

    const candidateId = inserted?.id;

    // Persiste formação acadêmica extraída pela IA / parser
    const academicList = assessmentForm.academic_list ?? [];
    if (candidateId && academicList.length > 0) {
      const educations = academicList.map(item => ({
        candidate_id: candidateId,
        institution_name: item.institution || "Não informada",
        degree: item.course || "Não informado",
        start_date: item.start_date || null,
        end_date: item.in_progress ? null : (item.end_date || null),
      }));
      const { error: eduError } = await supabase.from("candidate_educations").insert(educations);
      if (eduError) console.warn("Erro ao salvar formações:", eduError.message);
    }

    // Persiste experiências profissionais extraídas pela IA / parser
    const experienceList = assessmentForm.experience_list ?? [];
    if (candidateId && experienceList.length > 0) {
      const experiences = experienceList.map(item => ({
        candidate_id: candidateId,
        company_name: item.company || "Não informada",
        position_title: item.role || "Não informado",
        start_date: item.start_date || null,
        end_date: item.is_current ? null : (item.end_date || null),
        is_current: item.is_current ?? false,
        description: item.description || "",
      }));
      const { error: expError } = await supabase.from("candidate_experiences").insert(experiences);
      if (expError) console.warn("Erro ao salvar experiências:", expError.message);
    }

    alert("Candidato movido para o Banco de Talentos com sucesso!");
    setMovingToTalents(false);
  };

  const openNewModal = () => {
    setEditingId(null);
    setCurrentUpdatedAt(null);
    setForm({ candidate_name: "", role: "", phone: "", email: "", interview_date: "", interview_time: "", status: "Aguardando", result: "N/C" });
    setAssessmentForm(defaultAssessment);
    setActiveTab("dados");
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
    });
    setAssessmentForm(interview.assessment || defaultAssessment);
    setActiveTab("dados");
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

  const PREDEFINED_STRENGTHS = ["Proatividade", "Boa Comunicação", "Experiência", "Trabalho em Equipe", "Organização", "Liderança", "Foco em Resultados", "Empatia", "Resiliência"];
  const PREDEFINED_WEAKNESSES = ["Timidez", "Falta de Experiência Técnica", "Insegurança", "Dificuldade com Ferramentas", "Postura", "Conhecimento Básico", "Nervosismo", "Falta de Clareza"];

  const toggleListItem = (list: string, item: string) => {
    const arr = list ? list.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (arr.includes(item)) {
      return arr.filter(i => i !== item).join(', ');
    } else {
      return [...arr, item].join(', ');
    }
  };

  const generateParecerText = () => {
    const parts: string[] = [];
    if (assessmentForm.technical) parts.push(`Apresentou uma avaliação técnica ${assessmentForm.technical.toLowerCase()}.`);
    if (assessmentForm.communication) parts.push(`Sua comunicação foi avaliada como ${assessmentForm.communication.toLowerCase()}.`);
    if (assessmentForm.cultural_fit) parts.push(`Demonstrou aderência cultural ${assessmentForm.cultural_fit.toLowerCase()} com os valores da empresa.`);
    
    const fortes = assessmentForm.strengths ? assessmentForm.strengths.split(',').map(s => s.trim().toLowerCase()) : [];
    if (fortes.length > 0) {
      parts.push(`Como pontos fortes, destacou-se por apresentar ${fortes.join(', ')}.`);
    }

    const fracos = assessmentForm.weaknesses ? assessmentForm.weaknesses.split(',').map(s => s.trim().toLowerCase()) : [];
    if (fracos.length > 0) {
      parts.push(`Como pontos de atenção e desenvolvimento, notou-se: ${fracos.join(', ')}.`);
    }

    if (parts.length === 0) {
      parts.push("Nenhuma avaliação técnica ou comportamental preenchida.");
    } else {
      parts.push("Candidato(a) " + (form.result === "Aprovado" ? "recomendado(a) para a vaga." : form.result === "Reprovado" ? "não recomendado(a) para a vaga neste momento." : "aguardando definição final."));
    }

    setAssessmentForm(prev => ({
      ...prev,
      observations: parts.join(' ')
    }));
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Registro de Entrevistas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerenciamento de candidatos, avaliações e pareceres.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportToCsv} disabled={filtered.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
            <Button variant="secondary" onClick={() => { setResumeText(""); setIsResumeModalOpen(true); }} className="gap-2">
              <FileText className="h-4 w-4" />
              Ler Currículo
            </Button>
            <Button onClick={openNewModal} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Entrevista
            </Button>
          </div>
        </header>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric icon={User} label="Total Registros" value={filtered.length} />
          <Metric icon={Calendar} label="Confirmados" value={confirmados} />
          <Metric icon={CheckCircle2} label="Compareceram" value={compareceram} />
          <Metric icon={CheckCircle2} label="Aprovados" value={aprovados} />
        </div>

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
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading && (
                  <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>Carregando entrevistas...</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>Nenhum registro encontrado.</td></tr>
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
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
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
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b shrink-0">
              <div>
                <h2 className="text-lg font-semibold">{editingId ? "Editar Entrevista & Avaliação" : "Registrar Nova Entrevista"}</h2>
                <p className="text-sm text-muted-foreground">
                  {editingId ? "Altere dados do candidato ou adicione o parecer da entrevista." : "Preencha os dados do candidato e da entrevista."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {editingId && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setViewingCandidateProfile({ interviewId: editingId, email: form.email, name: form.candidate_name })}
                    className="gap-1.5 text-xs text-primary border-primary/20 hover:bg-primary/5 shadow-xs"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Ver Dossiê / Currículo Completo
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            
            <div className="border-b px-6 flex gap-6 shrink-0">
              <button 
                onClick={() => setActiveTab("dados")}
                className={`py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === "dados" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                Dados Básicos
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab("avaliacao")}
                className={`py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === "avaliacao" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                Parecer / Avaliação
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab("curriculo")}
                className={`py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === "curriculo" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                Currículo / Perfil
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col">
              {activeTab === "dados" && (
                <div className="grid grid-cols-2 gap-4 flex-1">
                  <div className="space-y-1 col-span-2">
                    <Label>Nome do Candidato <span className="text-red-500">*</span></Label>
                    <Input 
                      required 
                      value={form.candidate_name} 
                      onChange={e => setForm({...form, candidate_name: e.target.value})} 
                      placeholder="Ex: João da Silva" 
                    />
                  </div>
                  
                  <div className="space-y-1 col-span-2 md:col-span-1">
                    <Label>Cargo Alvo</Label>
                    <select 
                      value={form.role} 
                      onChange={e => setForm({...form, role: e.target.value})}
                      className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Selecione um cargo...</option>
                      {Array.from(new Set([...roles, form.role].filter(Boolean))).map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1 col-span-2 md:col-span-1">
                    <Label>Telefone</Label>
                    <Input 
                      value={form.phone} 
                      onChange={e => setForm({...form, phone: e.target.value})} 
                      placeholder="(XX) XXXXX-XXXX" 
                    />
                  </div>

                  <div className="space-y-1 col-span-2">
                    <Label>E-mail</Label>
                    <Input 
                      type="email"
                      value={form.email} 
                      onChange={e => setForm({...form, email: e.target.value})} 
                      placeholder="joao@email.com" 
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Data da Entrevista <span className="text-red-500">*</span></Label>
                    <Input 
                      type="date"
                      required
                      value={form.interview_date} 
                      onChange={e => setForm({...form, interview_date: e.target.value})} 
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Horário</Label>
                    <Input 
                      type="time"
                      value={form.interview_time} 
                      onChange={e => setForm({...form, interview_time: e.target.value})} 
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Status</Label>
                    <select 
                      value={form.status} 
                      onChange={e => setForm({...form, status: e.target.value})}
                      className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="Aguardando">Aguardando</option>
                      <option value="Confirmado">Confirmado</option>
                      <option value="Compareceu">Compareceu</option>
                      <option value="Desistente">Desistente</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label>Resultado da entrevista com a GP</Label>
                    <select 
                      value={form.result} 
                      onChange={e => setForm({...form, result: e.target.value})}
                      className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="N/C">N/C (Não Concluído)</option>
                      <option value="Aprovado">Aprovado</option>
                      <option value="Reprovado">Reprovado</option>
                      <option value="Desistente">Desistente</option>
                      <option value="Banco de Talentos">Banco de Talentos</option>
                      <option value="Avaliação Comportamental">Avaliação Comportamental</option>
                    </select>
                  </div>
                  
                  {form.result === "Avaliação Comportamental" && (
                    <div className="col-span-2 p-4 mt-2 border rounded-md bg-muted/50 flex flex-col space-y-2">
                      <Label>Link para Avaliação Comportamental (Big 5)</Label>
                      <p className="text-xs text-muted-foreground">Copie o link abaixo e envie ao candidato para a realização do teste.</p>
                      <div className="flex items-center gap-2">
                        <Input 
                          readOnly 
                          value={`https://gestaopessoas.github.io/colaborador/teste-personalidade?session=${editingId || 'novo-candidato'}`} 
                          className="bg-background text-sm font-mono"
                        />
                        <Button 
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            navigator.clipboard.writeText(`https://gestaopessoas.github.io/colaborador/teste-personalidade?session=${editingId || 'novo-candidato'}`);
                            alert("Link copiado!");
                          }}
                        >
                          Copiar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
            )}
            
            {activeTab === "dados" && (form.result === "Aprovado" || form.result === "Banco de Talentos") && (
              <div className="px-6 py-4 bg-muted/30 border-t space-y-4">
                <div className="space-y-2">
                  <Label>Disponibilidade de Obra / Sede</Label>
                  <select
                    value={assessmentForm.worksite_type || 'all'}
                    onChange={e => setAssessmentForm({...assessmentForm, worksite_type: e.target.value as "all" | "specific", available_worksites: []})}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                  >
                    <option value="all">Disponível para Todas as Obras</option>
                    <option value="specific">Obras Específicas...</option>
                  </select>
                </div>
                
                {assessmentForm.worksite_type === 'specific' && (
                  <div className="space-y-2 p-3 border rounded-md bg-background">
                    <Label className="text-xs text-muted-foreground uppercase">Selecione as obras adequadas ao perfil:</Label>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto mt-2">
                      {worksites.map(w => (
                        <label key={w} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded">
                          <input 
                            type="checkbox" 
                            checked={(assessmentForm.available_worksites || []).includes(w)}
                            onChange={(e) => {
                              const current = assessmentForm.available_worksites || [];
                              const next = e.target.checked 
                                ? [...current, w] 
                                : current.filter((x: string) => x !== w);
                              setAssessmentForm({...assessmentForm, available_worksites: next});
                            }}
                            className="rounded border-input"
                          />
                          <span className="truncate">{w}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "avaliacao" && (
                <div className="space-y-5 flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Obra / Sede</Label>
                      <Input value={assessmentForm.worksite || ''} onChange={e => setAssessmentForm({...assessmentForm, worksite: e.target.value})} placeholder="Ex: Obra A" />
                    </div>
                    <div className="space-y-1">
                      <Label>Fase do Processo</Label>
                      <select value={assessmentForm.selection_stage || ''} onChange={e => setAssessmentForm({...assessmentForm, selection_stage: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm">
                        <option value="">Selecione a fase unificada...</option>
                        <option value="Triagem">Triagem</option>
                        <option value="Entrevista RH">Entrevista RH (Gestão de Pessoas)</option>
                        <option value="Entrevista Gestor">Entrevista Gestor</option>
                        <option value="Testagem Psicológica">Testagem Psicológica</option>
                        <option value="Coleta de Documentos & Exames">Coleta de Documentos & Exames</option>
                        <option value="Proposta / Aguardando Contratação">Proposta / Aguardando Contratação</option>
                        <option value="Contratado">Contratado</option>
                        <option value="Banco de Talentos">Banco de Talentos</option>
                        <option value="Reprovado">Reprovado</option>
                        <option value="Desistente">Desistente</option>
                        <option value="Outros">Outros</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Teste Psicológico Realizado?</Label>
                      <select 
                        value={assessmentForm.psychological_test} 
                        onChange={e => setAssessmentForm({...assessmentForm, psychological_test: e.target.value})}
                        className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="Não">Não</option>
                        <option value="Sim">Sim</option>
                      </select>
                    </div>

                                        {assessmentForm.psychological_test === "Sim" && (
                      <div className="space-y-4 md:col-span-2 p-5 bg-muted/30 rounded-lg border border-border/50">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold">Testes Psicológicos</Label>
                          <Button type="button" size="sm" variant="outline" onClick={() => setAssessmentForm(p => ({...p, tests_list: [...(p.tests_list || []), { test_name: "G36", score: "" }]}))}>
                            <Plus className="h-4 w-4 mr-2" /> Adicionar Teste
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 border-b border-border/50 pb-4">
                          <div className="space-y-1">
                            <Label>Idade do Candidato</Label>
                            <Input type="number" placeholder="Ex: 25" value={assessmentForm.age || ''} onChange={e => setAssessmentForm({...assessmentForm, age: e.target.value})} />
                          </div>
                          <div className="space-y-1">
                            <Label>Escolaridade</Label>
                            <select value={assessmentForm.education || 'Ensino Médio'} onChange={e => setAssessmentForm({...assessmentForm, education: e.target.value})} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                              <option value="Ensino Fundamental">Ensino Fundamental</option>
                              <option value="Ensino Médio">Ensino Médio</option>
                              <option value="Ensino Superior">Ensino Superior</option>
                              <option value="Pós-graduação">Pós-graduação</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {(assessmentForm.tests_list || []).map((t, index) => {
                            const isNeo = t.test_name.includes("NEO");
                            return (
                            <div key={index} className="flex flex-col space-y-3 p-3 border border-border/50 bg-background rounded-md relative">
                              <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-100" onClick={() => {
                                const list = [...(assessmentForm.tests_list || [])];
                                list.splice(index, 1);
                                setAssessmentForm(p => ({...p, tests_list: list}));
                              }}>
                                <X className="h-4 w-4" />
                              </Button>
                              <div className="flex flex-col md:flex-row gap-3 pr-8">
                                <div className="flex-1 space-y-1">
                                  <Label>Nome do Teste</Label>
                                  <select value={t.test_name} onChange={e => {
                                      const list = [...(assessmentForm.tests_list || [])];
                                      const newTest = e.target.value;
                                      list[index] = { ...list[index], test_name: newTest };
                                      if (newTest.includes("NEO")) list[index].factors = {N:"", E:"", O:"", A:"", C:""};
                                      
                                      const opts = TEST_OPTIONS[newTest];
                                      if (opts && opts.length > 0) {
                                        list[index].table_name = opts[0].table_name;
                                        list[index].demographic_type = opts[0].demographic_type;
                                        list[index].demographic_value = opts[0].demographic_value;
                                      } else {
                                        list[index].table_name = ""; list[index].demographic_type = ""; list[index].demographic_value = "";
                                      }
                                      setAssessmentForm(p => ({...p, tests_list: list}));
                                    }}
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                                    <option value="G36">G36 (Inteligência/Lógico)</option>
                                    <option value="TEALT">TEALT (Atenção Alternada)</option>
                                    <option value="TEADI">TEADI (Atenção Dividida)</option>
                                    <option value="TEACO-FF">TEACO-FF (Atenção Concentrada)</option>
                                    <option value="NEO PI-R">NEO PI-R (Personalidade)</option>
                                    <option value="NEO FFI-R">NEO FFI-R (Personalidade)</option>
                                    <option value="Palográfico">Palográfico</option>
                                  </select>
                                </div>
                                <div className="flex-[2] space-y-1">
                                  <Label>Tabela Normativa</Label>
                                  <select value={t.table_name + "|" + t.demographic_type + "|" + t.demographic_value} onChange={e => {
                                      const [tb, dt, dv] = e.target.value.split('|');
                                      const list = [...(assessmentForm.tests_list || [])];
                                      list[index] = { ...list[index], table_name: tb, demographic_type: dt, demographic_value: dv };
                                      setAssessmentForm(p => ({...p, tests_list: list}));
                                    }}
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm truncate">
                                    {(TEST_OPTIONS[t.test_name] || []).map((opt, i) => (
                                      <option key={i} value={`${opt.table_name}|${opt.demographic_type}|${opt.demographic_value}`}>
                                        {opt.label}
                                      </option>
                                    ))}
                                    {!(TEST_OPTIONS[t.test_name] || []).length && <option value="||">Nenhuma tabela (Teste não cadastrado)</option>}
                                  </select>
                                </div>
                                {!isNeo && (
                                  <div className="flex-1 space-y-1">
                                    <Label>Pontuação (Acertos)</Label>
                                    <Input type="number" placeholder="Ex: 45" value={t.score} onChange={e => {
                                      const list = [...(assessmentForm.tests_list || [])];
                                      list[index].score = e.target.value;
                                      setAssessmentForm(p => ({...p, tests_list: list}));
                                    }} />
                                  </div>
                                )}
                              </div>
                              {isNeo && (
                                <div className="grid grid-cols-5 gap-2 mt-2 pt-2 border-t border-border/30">
                                  {["N", "E", "O", "A", "C"].map(f => (
                                    <div key={f} className="space-y-1">
                                      <Label title={f === 'N' ? 'Neuroticismo' : f === 'E' ? 'Extroversão' : f === 'O' ? 'Abertura' : f === 'A' ? 'Amabilidade' : 'Conscienciosidade'} className="cursor-help">Fator {f}</Label>
                                      <Input type="number" placeholder="0" value={t.factors?.[f as keyof typeof t.factors] || ''} onChange={e => {
                                        const list = [...(assessmentForm.tests_list || [])];
                                        if(!list[index].factors) list[index].factors = {};
                                        // @ts-ignore
                                        list[index].factors[f] = e.target.value;
                                        setAssessmentForm(p => ({...p, tests_list: list}));
                                      }} className="h-8 px-2" />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )})}
                          {(assessmentForm.tests_list || []).length === 0 && (
                            <div className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-md">
                              Nenhum teste adicionado. Clique no botão acima para adicionar.
                            </div>
                          )}
                        </div>

                        <div className="flex items-end pt-2">
                          <Button type="button" onClick={handleGenerateTestText} disabled={isGeneratingTest || (assessmentForm.tests_list || []).length === 0} className="w-full font-medium">
                            {isGeneratingTest ? "Calculando e Gerando Parecer..." : "Calcular Classificação & Gerar Parecer (IA)"}
                          </Button>
                        </div>

                        <div className="space-y-1 pt-2">
                          <Label>Resultado Final dos Testes (Gerado)</Label>
                          <Textarea 
                            placeholder="O parecer detalhado aparecerá aqui após o cálculo..."
                            value={assessmentForm.tests_details || ''}
                            onChange={(e) => setAssessmentForm({ ...assessmentForm, tests_details: e.target.value })}
                            className="min-h-[120px]"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label>Avaliação Técnica</Label>
                      <select 
                        value={assessmentForm.technical} 
                        onChange={e => setAssessmentForm({...assessmentForm, technical: e.target.value})}
                        className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">Selecione...</option>
                        <option value="Excelente">Excelente (Domina o assunto)</option>
                        <option value="Boa">Boa (Tem conhecimento sólido)</option>
                        <option value="Básica">Básica (Precisa de treinamento)</option>
                        <option value="Insuficiente">Insuficiente (Não atende aos requisitos)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label>Comunicação</Label>
                      <select 
                        value={assessmentForm.communication} 
                        onChange={e => setAssessmentForm({...assessmentForm, communication: e.target.value})}
                        className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">Selecione...</option>
                        <option value="Excelente">Excelente (Articulado e claro)</option>
                        <option value="Boa">Boa (Comunica-se bem)</option>
                        <option value="Razoável">Razoável (Um pouco retraído)</option>
                        <option value="Ruim">Ruim (Dificuldade de expressão)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label>Fit Cultural (Aderência)</Label>
                      <select 
                        value={assessmentForm.cultural_fit} 
                        onChange={e => setAssessmentForm({...assessmentForm, cultural_fit: e.target.value})}
                        className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">Selecione...</option>
                        <option value="Alta">Alta (Total aderência aos valores)</option>
                        <option value="Média">Média (Aderência parcial)</option>
                        <option value="Baixa">Baixa (Pouca aderência aos valores)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-medium">Pontos Fortes</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {PREDEFINED_STRENGTHS.map(item => {
                        const checked = (assessmentForm.strengths || "").includes(item);
                        return (
                          <div key={item} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`strength-${item}`} 
                              checked={checked}
                              onCheckedChange={() => setAssessmentForm(prev => ({...prev, strengths: toggleListItem(prev.strengths, item)}))}
                            />
                            <Label htmlFor={`strength-${item}`} className="text-sm font-normal cursor-pointer leading-tight">{item}</Label>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-medium">Pontos a Desenvolver</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {PREDEFINED_WEAKNESSES.map(item => {
                        const checked = (assessmentForm.weaknesses || "").includes(item);
                        return (
                          <div key={item} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`weakness-${item}`} 
                              checked={checked}
                              onCheckedChange={() => setAssessmentForm(prev => ({...prev, weaknesses: toggleListItem(prev.weaknesses, item)}))}
                            />
                            <Label htmlFor={`weakness-${item}`} className="text-sm font-normal cursor-pointer leading-tight">{item}</Label>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-2 border-t pt-4 mt-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">Parecer Final / Observações</Label>
                      <Button type="button" size="sm" variant="outline" onClick={generateParecerText} className="gap-2 text-primary border-primary/50 hover:bg-primary/10">
                        <span className="text-lg leading-none">🪄</span> Gerar Parecer
                      </Button>
                    </div>
                    <Textarea 
                      value={assessmentForm.observations} 
                      onChange={e => setAssessmentForm({...assessmentForm, observations: e.target.value})}
                      placeholder="O texto gerado aparecerá aqui. Você também pode digitar manualmente..."
                      className="resize-none min-h-[100px]"
                    />
                  </div>
                </div>
              )}

              {activeTab === "curriculo" && (
                <div className="space-y-5 flex-1 overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Idade / Nascimento</Label>
                      <Input 
                        value={assessmentForm.age || ''} 
                        onChange={e => setAssessmentForm({...assessmentForm, age: e.target.value})} 
                        placeholder="Ex: 33 anos" 
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Cidade / Estado</Label>
                      <Input 
                        value={assessmentForm.location || ''} 
                        onChange={e => setAssessmentForm({...assessmentForm, location: e.target.value})} 
                        placeholder="Ex: Pelotas - RS" 
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Tipo de Candidato</Label>
                      <select 
                        value={assessmentForm.is_internal ? "interno" : "externo"} 
                        onChange={e => setAssessmentForm({...assessmentForm, is_internal: e.target.value === "interno"})}
                        className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="externo">Candidato Externo</option>
                        <option value="interno">Candidato Interno</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Escolaridade / Resumo Formação</Label>
                      <Input 
                        value={assessmentForm.education || ''} 
                        onChange={e => setAssessmentForm({...assessmentForm, education: e.target.value})} 
                        placeholder="Ex: Formado em Psicologia" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label className="text-sm font-medium">Endereço Completo</Label>
                    <Input 
                      value={assessmentForm.address || ''} 
                      onChange={e => setAssessmentForm({...assessmentForm, address: e.target.value})}
                      placeholder="Ex: Rua XYZ, Centro, Pelotas - RS"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 pt-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Informações Pessoais</Label>
                      <Textarea 
                        value={assessmentForm.personal_info || ''} 
                        onChange={e => setAssessmentForm({...assessmentForm, personal_info: e.target.value})}
                        placeholder="Ex: Nascimento, Gênero, Estado civil..."
                        className="resize-none min-h-[70px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Diversidade</Label>
                      <Textarea 
                        value={assessmentForm.diversity_info || ''} 
                        onChange={e => setAssessmentForm({...assessmentForm, diversity_info: e.target.value})}
                        placeholder="Ex: Raça/cor, Orientação..."
                        className="resize-none min-h-[70px]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label className="text-sm font-medium">Informações Adicionais</Label>
                    <Textarea 
                      value={assessmentForm.additional_info || ''} 
                      onChange={e => setAssessmentForm({...assessmentForm, additional_info: e.target.value})}
                      placeholder="Ex: Pretensão salarial, Possui CNH, etc..."
                      className="resize-none min-h-[70px]"
                    />
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label className="text-sm font-medium">Resumo Profissional</Label>
                    <Textarea 
                      value={assessmentForm.professional_summary || ''} 
                      onChange={e => setAssessmentForm({...assessmentForm, professional_summary: e.target.value})}
                      placeholder="Resumo das principais qualificações e objetivos teóricos ou de carreira..."
                      className="resize-none min-h-[90px]"
                    />
                  </div>

                  {/* FORMAÇÃO ACADÊMICA E CURSOS */}
                  <div className="space-y-3 pt-3 border-t">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-semibold text-foreground">Formação Acadêmica & Cursos</Label>
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setAssessmentForm(p => ({
                          ...p, 
                          academic_list: [
                            ...(p.academic_list || []), 
                            { id: String(Date.now()), course: "", institution: "", start_date: "", end_date: "", in_progress: false }
                          ]
                        }))}
                        className="h-8 gap-1.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar Formação
                      </Button>
                    </div>

                    {(assessmentForm.academic_list || []).length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg bg-muted/10">
                        Nenhuma formação cadastrada. Clique em "+ Adicionar Formação" para registrar cursos e graduações do candidato.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(assessmentForm.academic_list || []).map((ac, idx) => (
                          <div key={ac.id || idx} className="p-3.5 border rounded-lg bg-muted/20 space-y-3 relative group">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 space-y-1">
                                <Label className="text-xs text-muted-foreground">Graduação / Curso</Label>
                                <Input 
                                  value={ac.course || ""} 
                                  onChange={e => {
                                    const list = [...(assessmentForm.academic_list || [])];
                                    list[idx] = { ...list[idx], course: e.target.value };
                                    setAssessmentForm(p => ({ ...p, academic_list: list }));
                                  }}
                                  placeholder="Ex: Psicologia Clínica e Organizacional"
                                  className="h-9 font-medium"
                                />
                              </div>
                              <div className="flex-1 space-y-1">
                                <Label className="text-xs text-muted-foreground">Instituição</Label>
                                <Input 
                                  value={ac.institution || ""} 
                                  onChange={e => {
                                    const list = [...(assessmentForm.academic_list || [])];
                                    list[idx] = { ...list[idx], institution: e.target.value };
                                    setAssessmentForm(p => ({ ...p, academic_list: list }));
                                  }}
                                  placeholder="Ex: UFPEL / PUCRS"
                                  className="h-9"
                                />
                              </div>
                              <div className="pt-5">
                                <Button 
                                  type="button" 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={() => {
                                    const list = (assessmentForm.academic_list || []).filter((_, i) => i !== idx);
                                    setAssessmentForm(p => ({ ...p, academic_list: list }));
                                  }}
                                  className="h-9 w-9 text-destructive hover:bg-destructive/10 shrink-0"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="w-1/3 space-y-1">
                                <Label className="text-xs text-muted-foreground">Data de Início</Label>
                                <Input 
                                  value={ac.start_date || ""} 
                                  onChange={e => {
                                    const list = [...(assessmentForm.academic_list || [])];
                                    list[idx] = { ...list[idx], start_date: e.target.value };
                                    setAssessmentForm(p => ({ ...p, academic_list: list }));
                                  }}
                                  placeholder="Ex: 2011 ou 03/2011"
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="w-1/3 space-y-1">
                                <Label className="text-xs text-muted-foreground">Data de Finalização</Label>
                                <Input 
                                  value={ac.end_date || ""} 
                                  disabled={ac.in_progress}
                                  onChange={e => {
                                    const list = [...(assessmentForm.academic_list || [])];
                                    list[idx] = { ...list[idx], end_date: e.target.value };
                                    setAssessmentForm(p => ({ ...p, academic_list: list }));
                                  }}
                                  placeholder={ac.in_progress ? "Em andamento" : "Ex: 2015 ou 12/2015"}
                                  className="h-8 text-xs disabled:opacity-50"
                                />
                              </div>
                              <div className="flex items-center space-x-2 pt-5">
                                <Checkbox 
                                  id={`in-progress-${idx}`} 
                                  checked={Boolean(ac.in_progress)}
                                  onCheckedChange={(checked) => {
                                    const list = [...(assessmentForm.academic_list || [])];
                                    list[idx] = { ...list[idx], in_progress: Boolean(checked), end_date: checked ? "" : list[idx].end_date };
                                    setAssessmentForm(p => ({ ...p, academic_list: list }));
                                  }}
                                />
                                <Label htmlFor={`in-progress-${idx}`} className="text-xs cursor-pointer font-normal text-muted-foreground">
                                  Em andamento
                                </Label>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* HISTÓRICO PROFISSIONAL E EXPERIÊNCIAS */}
                  <div className="space-y-3 pt-3 border-t">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-semibold text-foreground">Histórico Profissional / Experiências</Label>
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setAssessmentForm(p => ({
                          ...p, 
                          experience_list: [
                            ...(p.experience_list || []), 
                            { id: String(Date.now()), role: "", company: "", start_date: "", end_date: "", is_current: false, description: "" }
                          ]
                        }))}
                        className="h-8 gap-1.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar Experiência
                      </Button>
                    </div>

                    {(assessmentForm.experience_list || []).length === 0 ? (
                      <div className="space-y-3">
                        <div className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg bg-muted/10">
                          Nenhum histórico profissional estruturado. Clique em "+ Adicionar Experiência" para incluir cargos, empresas e períodos.
                        </div>
                        {assessmentForm.experience_summary && (
                          <div className="space-y-1 pt-1">
                            <Label className="text-xs text-muted-foreground">Resumo Legado / Anotações Gerais de Experiência</Label>
                            <Textarea 
                              value={assessmentForm.experience_summary || ""} 
                              onChange={e => setAssessmentForm({...assessmentForm, experience_summary: e.target.value})}
                              placeholder="Descreva os cargos, empresas, períodos e principais atividades desenvolvidas..."
                              className="resize-none min-h-[90px] text-xs"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(assessmentForm.experience_list || []).map((ex, idx) => (
                          <div key={ex.id || idx} className="p-4 border rounded-lg bg-muted/20 space-y-3 relative group">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 space-y-1">
                                <Label className="text-xs text-muted-foreground">Cargo / Função</Label>
                                <Input 
                                  value={ex.role || ""} 
                                  onChange={e => {
                                    const list = [...(assessmentForm.experience_list || [])];
                                    list[idx] = { ...list[idx], role: e.target.value };
                                    setAssessmentForm(p => ({ ...p, experience_list: list }));
                                  }}
                                  placeholder="Ex: Psicólogo Clínico / Responsável Técnico"
                                  className="h-9 font-medium"
                                />
                              </div>
                              <div className="flex-1 space-y-1">
                                <Label className="text-xs text-muted-foreground">Empresa / Instituição</Label>
                                <Input 
                                  value={ex.company || ""} 
                                  onChange={e => {
                                    const list = [...(assessmentForm.experience_list || [])];
                                    list[idx] = { ...list[idx], company: e.target.value };
                                    setAssessmentForm(p => ({ ...p, experience_list: list }));
                                  }}
                                  placeholder="Ex: Vínculos Centro Especializado de Saúde"
                                  className="h-9"
                                />
                              </div>
                              <div className="pt-5">
                                <Button 
                                  type="button" 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={() => {
                                    const list = (assessmentForm.experience_list || []).filter((_, i) => i !== idx);
                                    setAssessmentForm(p => ({ ...p, experience_list: list }));
                                  }}
                                  className="h-9 w-9 text-destructive hover:bg-destructive/10 shrink-0"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="w-1/3 space-y-1">
                                <Label className="text-xs text-muted-foreground">Data de Início (Mês/Ano)</Label>
                                <Input 
                                  value={ex.start_date || ""} 
                                  onChange={e => {
                                    const list = [...(assessmentForm.experience_list || [])];
                                    list[idx] = { ...list[idx], start_date: e.target.value };
                                    setAssessmentForm(p => ({ ...p, experience_list: list }));
                                  }}
                                  placeholder="Ex: 08/2022"
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="w-1/3 space-y-1">
                                <Label className="text-xs text-muted-foreground">Data de Saída / Conclusão</Label>
                                <Input 
                                  value={ex.end_date || ""} 
                                  disabled={ex.is_current}
                                  onChange={e => {
                                    const list = [...(assessmentForm.experience_list || [])];
                                    list[idx] = { ...list[idx], end_date: e.target.value };
                                    setAssessmentForm(p => ({ ...p, experience_list: list }));
                                  }}
                                  placeholder={ex.is_current ? "Atualmente no cargo" : "Ex: 05/2024"}
                                  className="h-8 text-xs disabled:opacity-50"
                                />
                              </div>
                              <div className="flex items-center space-x-2 pt-5">
                                <Checkbox 
                                  id={`is-current-${idx}`} 
                                  checked={Boolean(ex.is_current)}
                                  onCheckedChange={(checked) => {
                                    const list = [...(assessmentForm.experience_list || [])];
                                    list[idx] = { ...list[idx], is_current: Boolean(checked), end_date: checked ? "" : list[idx].end_date };
                                    setAssessmentForm(p => ({ ...p, experience_list: list }));
                                  }}
                                />
                                <Label htmlFor={`is-current-${idx}`} className="text-xs cursor-pointer font-normal text-muted-foreground">
                                  Atual / Até o momento
                                </Label>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Descrição das Atividades & Conquistas</Label>
                              <Textarea 
                                value={ex.description || ""}
                                onChange={e => {
                                  const list = [...(assessmentForm.experience_list || [])];
                                  list[idx] = { ...list[idx], description: e.target.value };
                                  setAssessmentForm(p => ({ ...p, experience_list: list }));
                                }}
                                placeholder="Descreva as responsabilidades e atividades no cargo (ex: Psicoterapia de orientação analítica, gestão do quadro...)"
                                className="resize-none min-h-[70px] text-xs"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center gap-2 pt-4 border-t mt-auto shrink-0 flex-wrap">
                <div className="flex items-center gap-2">
                  {editingId && activeTab === "avaliacao" && (
                    <>
                      <Button type="button" variant="secondary" onClick={exportParecer} className="gap-2">
                        <FileText className="h-4 w-4" />
                        Exportar .txt
                      </Button>
                      <Button type="button" variant="outline" onClick={printParecer} className="gap-2 text-primary border-primary/50 hover:bg-primary/10">
                        🖨️ Imprimir / PDF
                      </Button>
                    </>
                  )}
                  {editingId && (
                    <Button type="button" variant="destructive" onClick={() => handleDelete(editingId)} className="gap-2">
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando..." : "Salvar Entrevista"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Leitura Currículo */}
      {isResumeModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  Ler Currículo
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => setIsKeyModalOpen(true)}>
                    <Key className="h-4 w-4" />
                  </Button>
                </h2>
                <p className="text-sm text-muted-foreground">Cole o texto do currículo (Ex: da Sólides ou outro formato) para preencher os dados via IA.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsResumeModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex justify-between items-center px-4 pt-4 border-b pb-4 bg-muted/5">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-primary hover:underline">
                <FileUp className="h-4 w-4" />
                Carregar de um arquivo (PDF, TXT)
                <input type="file" accept=".pdf,.txt" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
            <div className="p-4 space-y-4">
              <Textarea
                className="min-h-[300px] text-sm"
                placeholder="Cole o texto do currículo aqui ou faça o upload de um PDF..."
                value={resumeText}
                onChange={e => setResumeText(e.target.value)}
              />
            </div>
            <div className="flex justify-between p-4 border-t gap-2 bg-muted/10 items-center">
              <Button variant="ghost" className="text-muted-foreground text-xs" onClick={parseWithoutAI} disabled={!resumeText.trim()}>
                Analisar sem IA (Padrão Sólides)
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setIsResumeModalOpen(false)}>Cancelar</Button>
                <Button 
                  onClick={analyzeResume} 
                  disabled={!resumeText.trim() || isAnalyzingResume}
                  className="gap-2 text-primary border-primary hover:bg-primary/10"
                  variant="outline"
                >
                  <span className="text-lg leading-none">🪄</span> 
                  {isAnalyzingResume ? "Analisando..." : "Analisar via IA"}
                </Button>
              </div>
            </div>
          </div>
        </div>
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
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}
