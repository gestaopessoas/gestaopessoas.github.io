export function calculateMatchScore(candidateTags: string[] = [], jobTags: string[] = []): number {
  if (!jobTags?.length) return 0;
  const validJobTags = jobTags.filter(Boolean);
  if (!validJobTags.length) return 0;
  
  const matches = validJobTags.filter(tag => 
    candidateTags?.some(ct => ct?.toLowerCase().trim() === tag?.toLowerCase().trim())
  ).length;
  return Math.round((matches / validJobTags.length) * 100);
}
