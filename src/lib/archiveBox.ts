import { createClient } from "@/utils/supabase/client";

// Status que mandam o colaborador para o arquivo morto.
//
// "inactive" saiu da lista: a migration 20260904190000 normalizou as 4.505 linhas
// legadas em inglês para "Inativo", e o formulário nunca gravou o valor minúsculo.
//
// "Arquivo Morto" entrou. Sem ele, quem recebesse esse status pelo formulário sumia
// da própria tela /dashboard/arquivo-morto, que busca justamente por esta lista.
export const ARCHIVE_STATUSES = ["Inativo", "Desligado", "Arquivo Morto"];

/** Código da caixa física em que o colaborador está guardado, ou "" se não estiver em nenhuma. */
export async function getArchiveBoxCode(employeeId: string): Promise<string> {
  const { data } = await createClient()
    .from("employee_archives")
    .select("physical_boxes(code)")
    .eq("employee_id", employeeId)
    .maybeSingle();
  // O select traz um objeto (relação to-one), mas os tipos-stub do supabase o descrevem como array.
  const box = data?.physical_boxes as unknown as { code?: string } | null;
  return box?.code ?? "";
}

/** Códigos de todas as caixas cadastradas, para autocompletar. */
export async function listArchiveBoxCodes(): Promise<string[]> {
  const { data } = await createClient().from("physical_boxes").select("code").order("code");
  return (data ?? []).map((box) => box.code);
}

/**
 * Grava o vínculo do colaborador com a caixa física: código vazio apaga o vínculo,
 * código novo cria a caixa. Retorna a mensagem de erro, ou null em caso de sucesso.
 */
export async function saveArchiveBox(employeeId: string, boxCode: string): Promise<string | null> {
  const code = boxCode.trim();
  const sb = createClient();

  if (!code) {
    const { error } = await sb.from("employee_archives").delete().eq("employee_id", employeeId);
    return error?.message ?? null;
  }

  let { data: box } = await sb.from("physical_boxes").select("id").eq("code", code).single();
  if (!box) {
    const { data: newBox, error: newBoxError } = await sb
      .from("physical_boxes")
      .insert({ code, description: `Caixa ${code}` })
      .select("id")
      .single();
    if (newBoxError) return newBoxError.message;
    box = newBox;
  }

  // Um colaborador ocupa uma caixa só: o vínculo anterior sai antes do novo entrar.
  await sb.from("employee_archives").delete().eq("employee_id", employeeId);
  const { error: saveError } = await sb.from("employee_archives").insert({ employee_id: employeeId, box_id: box!.id });
  return saveError?.message ?? null;
}
