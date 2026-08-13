export type MatchResult = {
  score: number;
  matches: number;
  total: number;
};

export function calculateMatchScore(candidateTags: string[] = [], jobTags: string[] = []): MatchResult {
  if (!jobTags?.length) return { score: 0, matches: 0, total: 0 };
  const validJobTags = jobTags.filter(Boolean);
  if (!validJobTags.length) return { score: 0, matches: 0, total: 0 };
  
  const matches = validJobTags.filter(tag => 
    candidateTags?.some(ct => ct?.toLowerCase().trim() === tag?.toLowerCase().trim())
  ).length;
  
  return {
    score: Math.round((matches / validJobTags.length) * 100),
    matches,
    total: validJobTags.length
  };
}
