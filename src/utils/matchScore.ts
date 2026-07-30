export function calculateMatchScore(candidateTags: string[] = [], jobTags: string[] = []): number {
  if (!jobTags.length) return 0;
  const matches = jobTags.filter(tag => 
    candidateTags.some(ct => ct.toLowerCase().trim() === tag.toLowerCase().trim())
  ).length;
  return Math.round((matches / jobTags.length) * 100);
}
