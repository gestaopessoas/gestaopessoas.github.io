// Extração de currículo por IA para o modal de candidatura pública (/carreiras).
//
// Isolado de propósito: CandidateProfileModal.tsx e dashboard/entrevistas/page.tsx já têm
// suas próprias implementações de importação de currículo por IA — este módulo não as
// substitui nem é usado por elas, só serve ao novo fluxo do portal de carreiras.
//
// Todas as datas de academic_list/experience_list saem normalizadas em ISO (YYYY-MM-DD),
// tanto na rota de IA quanto no fallback local, porque candidate_educations.start_date/
// end_date e candidate_experiences.start_date/end_date são colunas `date`: qualquer string
// fora do formato ISO falha (ou é descartada) no insert.

import { parseSolidesResume } from "./resumeParser";

export type ParsedResumeAcademic = {
  course: string;
  institution: string;
  start_date: string | null;
  end_date: string | null;
  in_progress: boolean;
};

export type ParsedResumeExperience = {
  role: string;
  company: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string;
};

export type ParsedResumeFields = {
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  linkedin_url: string;
  academic_list: ParsedResumeAcademic[];
  experience_list: ParsedResumeExperience[];
};

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

/**
 * Converte datas em formatos comuns de currículo (YYYY, MM/YYYY, DD/MM/YYYY, YYYY-MM)
 * para ISO "YYYY-MM-DD". Retorna null quando não reconhece o formato — melhor gravar
 * data ausente do que uma string que quebra o insert na coluna `date`.
 */
export function normalizeResumeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  if (/^\d{4}$/.test(value)) return `${value}-01-01`;

  const monthYear = value.match(/^(\d{1,2})\/(\d{4})$/);
  if (monthYear) return `${monthYear[2]}-${monthYear[1].padStart(2, "0")}-01`;

  const dayMonthYear = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dayMonthYear) {
    return `${dayMonthYear[3]}-${dayMonthYear[2].padStart(2, "0")}-${dayMonthYear[1].padStart(2, "0")}`;
  }

  return null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeAcademic(item: Record<string, unknown>): ParsedResumeAcademic {
  const inProgress = Boolean(item?.in_progress);
  return {
    course: asString(item?.course),
    institution: asString(item?.institution),
    start_date: normalizeResumeDate(asString(item?.start_date)),
    end_date: inProgress ? null : normalizeResumeDate(asString(item?.end_date)),
    in_progress: inProgress,
  };
}

function normalizeExperience(item: Record<string, unknown>): ParsedResumeExperience {
  const isCurrent = Boolean(item?.is_current);
  return {
    role: asString(item?.role),
    company: asString(item?.company),
    start_date: normalizeResumeDate(asString(item?.start_date)),
    end_date: isCurrent ? null : normalizeResumeDate(asString(item?.end_date)),
    is_current: isCurrent,
    description: asString(item?.description),
  };
}

/**
 * Extração via IA (Gemini). Lança em qualquer falha (chave ausente, erro de rede, JSON
 * inválido) — quem chama deve capturar e cair no fallback local (parseResumeLocally).
 */
export async function analyzeResumeWithAI(text: string): Promise<ParsedResumeFields> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Chave Gemini não configurada");

  const prompt = `Extraia os seguintes dados do currículo abaixo e retorne APENAS um JSON válido, sem crases, sem markdown. Capture o máximo de detalhes possível de formação acadêmica e experiências profissionais.

IMPORTANTE: todas as datas (start_date, end_date) devem estar SEMPRE no formato ISO "YYYY-MM-DD" (use o dia 01 quando o currículo só tiver mês/ano ou só o ano). Nunca use "Mês/Ano" ou texto livre nas datas.

Formato esperado:
{
  "name": "Nome completo",
  "email": "Email principal",
  "phone": "Telefone com DDD",
  "city": "Cidade",
  "state": "Estado (sigla, ex: SP)",
  "linkedin_url": "URL do perfil do LinkedIn, se houver",
  "academic_list": [{ "course": "Curso", "institution": "Instituição", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "in_progress": boolean }],
  "experience_list": [{ "role": "Cargo", "company": "Empresa", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "is_current": boolean, "description": "Descrição das atividades" }]
}

Texto do currículo:
${text.substring(0, 8000)}`;

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 },
    }),
  });

  if (!res.ok) throw new Error("Erro na API Gemini");
  const json = await res.json();
  let rawStr = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawStr) throw new Error("Resposta vazia da IA");
  rawStr = rawStr.replace(/```json\n?|\n?```/g, "").trim();
  const parsed = JSON.parse(rawStr);

  return {
    name: parsed.name || "",
    email: parsed.email || "",
    phone: parsed.phone || "",
    city: parsed.city || "",
    state: parsed.state || "",
    linkedin_url: parsed.linkedin_url || "",
    academic_list: Array.isArray(parsed.academic_list) ? parsed.academic_list.map(normalizeAcademic) : [],
    experience_list: Array.isArray(parsed.experience_list) ? parsed.experience_list.map(normalizeExperience) : [],
  };
}

/**
 * Fallback sem IA — usa o parser calibrado em resumeParser.ts (Sólides) e normaliza a
 * saída pro mesmo formato ISO que analyzeResumeWithAI produz, pra as duas rotas serem
 * intercambiáveis no chamador.
 */
export function parseResumeLocally(text: string): ParsedResumeFields {
  const parsed = parseSolidesResume(text);
  const [city, state] = (parsed.location || "").split("-").map((part) => part.trim());
  return {
    name: parsed.name || "",
    email: parsed.email || "",
    phone: parsed.phone || "",
    city: city || "",
    state: state || "",
    linkedin_url: "",
    academic_list: (parsed.academic_list || []).map(normalizeAcademic),
    experience_list: (parsed.experience_list || []).map(normalizeExperience),
  };
}
