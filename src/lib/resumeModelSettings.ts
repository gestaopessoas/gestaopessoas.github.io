// Modelo de IA usado na importação de currículo, configurável pelo administrador.
//
// Antes o modelo era constante no código, repetida em quatro pontos. Quando o Google
// aposentou gemini-1.5-flash e depois gemini-2.5-flash, a importação parou de funcionar em
// produção e só voltou com deploy. Pior: como toda chamada de IA cai em try/catch com
// fallback para o parser local, o modelo morto NÃO aparecia como erro — a importação só
// devolvia pouca coisa, como se os currículos fossem ruins.
//
// Agora o valor vive em system_settings (chave "ai_resume", entrada path ["model"]), a mesma
// tabela usada pelas outras configurações e protegida por RLS que exige permissão de edição
// no módulo "configuracoes". Trocar de modelo passa a ser tarefa de administrador, sem deploy.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Usado quando ninguém configurou nada ainda, ou quando a leitura da configuração falha. */
export const DEFAULT_RESUME_MODEL = "gemini-3.6-flash";

// Guardado em system_settings.value (jsonb), NÃO em system_setting_entries.
// Motivo: a policy de system_setting_entries é
//   FOR ALL USING (can_access('configuracoes','view'))
// ou seja, exige permissão de Configurações até para LER. Quem importa currículo costuma ser
// o RH, que não tem esse acesso — a leitura seria bloqueada e cairia no padrão sem avisar,
// exatamente a falha silenciosa que esta configuração existe para eliminar.
// Já system_settings tem SELECT liberado para qualquer autenticado e escrita restrita a quem
// tem create/edit em 'configuracoes': leitura para todos, escrita só para o administrador.
export const SETTING_KEY = "ai_resume";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** URL de geração para um modelo. */
export function geminiGenerateUrl(model: string): string {
  return `${GEMINI_BASE}/models/${model}:generateContent`;
}

/**
 * Lê o modelo configurado. Nunca lança: qualquer falha (tabela vazia, RLS, rede) cai no
 * padrão, porque ficar sem importação é pior do que importar com o modelo padrão.
 */
export async function fetchResumeModel(supabase: SupabaseClient): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .maybeSingle();

    const model = (data?.value as { model?: string } | null)?.model;
    if (error || !model) return DEFAULT_RESUME_MODEL;
    return model;
  } catch {
    return DEFAULT_RESUME_MODEL;
  }
}

/** Grava o modelo escolhido. Requer create/edit em "configuracoes" (RLS). */
export async function saveResumeModel(supabase: SupabaseClient, model: string): Promise<void> {
  const { error } = await supabase.from("system_settings").upsert(
    {
      key: SETTING_KEY,
      value: { model },
      description: "Modelo Gemini usado na importação de currículo",
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
}

export type GeminiModelOption = { id: string; name: string };

/**
 * Lista os modelos Gemini disponíveis para a chave configurada. Só entram os que suportam
 * generateContent — a API também devolve modelos de embedding, que quebrariam a importação.
 */
export async function listGeminiModels(): Promise<GeminiModelOption[]> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Chave do Gemini não configurada no ambiente.");

  const res = await fetch(`${GEMINI_BASE}/models?key=${apiKey}`);
  if (!res.ok) throw new Error(`Erro ao listar modelos (HTTP ${res.status}).`);

  const data = await res.json();
  const models: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[] =
    data.models ?? [];

  return models
    .filter((model) => (model.supportedGenerationMethods ?? []).includes("generateContent"))
    .filter((model) => model.name.includes("gemini"))
    .map((model) => ({ id: model.name.replace("models/", ""), name: model.displayName || model.name }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Chamada mínima só para saber se o modelo responde. Existe para o erro aparecer na tela de
 * configuração, e não semanas depois disfarçado de "a importação veio fraca".
 */
export async function testResumeModel(model: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "Chave do Gemini não configurada no ambiente." };

  try {
    const res = await fetch(`${geminiGenerateUrl(model)}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Responda apenas: ok" }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 10 },
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { ok: false, error: body?.error?.message || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha de rede" };
  }
}
