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
import { buildResumeExtractionPrompt, parseExtractionResponse } from "./resumeExtractionPrompt";

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

import { normalizeResumeDate } from "./resumeDate";

export { normalizeResumeDate };

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

  const prompt = buildResumeExtractionPrompt(text);

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
  const rawStr = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawStr) throw new Error("Resposta vazia da IA");
  const parsed = parseExtractionResponse(rawStr) as Record<string, any>;

  // O prompt devolve "location" ("Cidade - UF"); city/state aqui saem daí.
  const [locCity, locState] = asString(parsed.location).split(/\s*-\s*/);

  return {
    name: asString(parsed.name),
    email: asString(parsed.email),
    phone: asString(parsed.phone),
    city: asString(parsed.city) || (locCity ?? "").trim(),
    state: asString(parsed.state) || (locState ?? "").trim(),
    linkedin_url: asString(parsed.linkedin_url),
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
