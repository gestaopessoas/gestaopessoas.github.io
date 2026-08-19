// src/lib/codeLookup.ts

interface CargoEntry {
  title: string;
  profile_code?: string;
  cbo?: string;
}

interface CboEntry {
  code: string;
  title: string;
}

// Function to fetch cargos from Supabase if we were running in a component,
// but for the lookup logic, we pass the data array directly so it can be tested without DB.
// In the component, we would do: const data = await supabase.from('job_profiles').select('*')
export const normalizeString = (str: string) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .trim();
};

export const findCode = (
  query: string,
  sourceType: 'cargo' | 'cbo',
  sourceData: any[]
): { code: string | null; matches: { code: string; title: string }[] } => {
  
  const normalizedQuery = normalizeString(query);
  if (!normalizedQuery) return { code: null, matches: [] };

  const candidates: { code: string; title: string; score: number }[] = [];

  for (const item of sourceData) {
    let title = "";
    let code = "";

    if (sourceType === 'cargo') {
      title = item.title;
      code = item.profile_code || "";
    } else {
      title = item.title;
      code = item.code || "";
    }

    if (!code) continue;

    const normalizedTitle = normalizeString(title);
    
    if (normalizedTitle === normalizedQuery) {
      // Exact match
      return { code, matches: [{ code, title }] };
    }

    if (normalizedTitle.includes(normalizedQuery)) {
      candidates.push({
        code,
        title,
        score: normalizedTitle.length - normalizedQuery.length // smaller score is better
      });
    }
  }

  if (candidates.length === 0) {
    return { code: null, matches: [] };
  }

  // Sort by score (closest match first)
  candidates.sort((a, b) => a.score - b.score);

  return {
    code: candidates.length === 1 ? candidates[0].code : null, // If exactly 1 match, auto-select it. Otherwise return list for user to pick.
    matches: candidates.map(c => ({ code: c.code, title: c.title }))
  };
};
