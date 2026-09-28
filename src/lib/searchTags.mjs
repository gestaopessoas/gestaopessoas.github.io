// Tags de busca da vaga, gerenciadas em Configurações (issue #162).
// Guardadas em system_setting_entries: setting_key='search_tags', path = [categoria, ordem].
// Usado por configuracoes/page.tsx, VagaForm.tsx e solicitar-vaga/page.tsx.

export const ORPHAN_CATEGORY = "Outras";

/**
 * Agrupa as entradas por categoria (ordem alfabética), mantendo a ordem das tags.
 * @param {{ path: string[], value_text: string | null }[]} entries
 * @returns {{ category: string, tags: string[] }[]}
 */
export function groupSearchTags(entries) {
  const byCategory = new Map();
  for (const entry of entries) {
    if (!entry.value_text || entry.path.length < 2) continue;
    const list = byCategory.get(entry.path[0]) ?? [];
    list.push({ order: Number(entry.path[1]), tag: entry.value_text });
    byCategory.set(entry.path[0], list);
  }
  return [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([category, list]) => ({ category, tags: list.sort((a, b) => a.order - b.order).map((item) => item.tag) }));
}

/**
 * Tag marcada na vaga que saiu da lista entra no grupo "Outras", para não sumir ao editar.
 * @param {{ category: string, tags: string[] }[]} groups
 * @param {string[]} selected
 */
export function withOrphanTags(groups, selected) {
  const known = new Set(groups.flatMap((group) => group.tags));
  const orphans = selected.filter((tag) => !known.has(tag));
  return orphans.length ? [...groups, { category: ORPHAN_CATEGORY, tags: orphans }] : groups;
}

/**
 * Converte os grupos de volta para linhas de system_setting_entries.
 * @param {{ category: string, tags: string[] }[]} groups
 */
export function searchTagEntries(groups) {
  return groups.flatMap((group) => group.tags.map((tag, index) => ({
    setting_key: "search_tags", path: [group.category, String(index)], value_type: "string", value_text: tag,
  })));
}
