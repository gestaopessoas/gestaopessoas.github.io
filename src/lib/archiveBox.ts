import { createClient } from "@/utils/supabase/client";

// Status que, por si só, mandam o colaborador para o arquivo morto.
//
// "inactive" saiu da lista: a migration 20260904190000 normalizou as 4.505 linhas
// legadas em inglês para "Inativo", e o formulário nunca gravou o valor minúsculo.
//
// "Arquivo Morto" entrou. Sem ele, quem recebesse esse status pelo formulário sumia
// da própria tela /dashboard/arquivo-morto.
//
// Atenção: estar no arquivo morto NÃO é mais só uma questão de status. Quem tem caixa
// física também está lá, mesmo continuando ativo — é o caso de quem foi readmitido ou
// saiu de CLT e voltou como PJ. Quem precisa da lista completa usa a view
// `arquivo_morto`, que junta os dois critérios.
export const ARCHIVE_STATUSES = ["Inativo", "Desligado", "Arquivo Morto"];

/** Uma passagem arquivada: um dossiê numa caixa física. */
export type ArchiveBox = {
  /** id da linha em employee_archives — é o que `removeArchiveBox` recebe. */
  id: string;
  code: string;
  /** Rótulo escrito pelo RH ("CLT 2019-2022"), ou null. */
  label: string | null;
};

/**
 * Caixas em que o colaborador está arquivado, da mais antiga para a mais recente.
 * Pode ser mais de uma: admissão → demissão → admissão → demissão gera um dossiê por
 * passagem.
 */
export async function listArchiveBoxes(employeeId: string): Promise<ArchiveBox[]> {
  const { data } = await createClient()
    .from("employee_archives")
    .select("id, label, created_at, physical_boxes(code)")
    .eq("employee_id", employeeId)
    .order("created_at");

  return (data ?? []).map((row) => ({
    id: row.id as string,
    // O select traz um objeto (relação to-one), mas os tipos-stub do supabase o
    // descrevem como array — daí o passo por `unknown`.
    code: (row.physical_boxes as unknown as { code?: string } | null)?.code ?? "",
    label: (row.label as string | null) ?? null,
  }));
}

/** Códigos de todas as caixas cadastradas, para autocompletar. */
export async function listArchiveBoxCodes(): Promise<string[]> {
  const { data } = await createClient().from("physical_boxes").select("code").order("code");
  return (data ?? []).map((box) => box.code);
}

/**
 * Arquiva mais uma passagem do colaborador na caixa informada, criando a caixa se ela
 * ainda não existir. As caixas anteriores continuam onde estão — cada passagem pela
 * empresa tem o seu próprio dossiê. Retorna a mensagem de erro, ou null se deu certo.
 */
export async function addArchiveBox(
  employeeId: string,
  boxCode: string,
  label?: string
): Promise<string | null> {
  const code = boxCode.trim();
  if (!code) return "Informe o código da caixa.";

  const sb = createClient();

  let { data: box } = await sb.from("physical_boxes").select("id").eq("code", code).maybeSingle();
  if (!box) {
    const { data: newBox, error: newBoxError } = await sb
      .from("physical_boxes")
      .insert({ code, description: `Caixa ${code}` })
      .select("id")
      .single();
    if (newBoxError) return newBoxError.message;
    box = newBox;
  }

  const { error: saveError } = await sb.from("employee_archives").insert({
    employee_id: employeeId,
    box_id: box!.id,
    label: label?.trim() || null,
  });
  return saveError?.message ?? null;
}

/** Tira uma passagem do arquivo. Recebe o id da linha, não o do colaborador. */
export async function removeArchiveBox(archiveId: string): Promise<string | null> {
  const { error } = await createClient().from("employee_archives").delete().eq("id", archiveId);
  return error?.message ?? null;
}
