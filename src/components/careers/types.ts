export type Career = {
  id: string;
  status: string;
  cost_center: string | null;
  contract_type: string | null;
  target_date: string | null;
  observations: string | null;
  created_at: string;
  department: string | null;
  salary_min: number | null;
  salary_max: number | null;
  seniority: string | null;
  work_mode: string | null;
  is_pcd_eligible: boolean;
  affirmative_tags: string[];
  profile: {
    title: string | null;
    profile_code: string | null;
    min_education: string | null;
    desired_education: string | null;
    min_experience: string | null;
    desired_experience: string | null;
    knowledge: string | null;
    activities: string | null;
    competencies: string | null;
  } | null;
};

export function formatSalaryRange(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (min && max && min !== max) return `${fmt(min)} - ${fmt(max)}`;
  return fmt(min || max || 0);
}

export function timeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return "Postada hoje";
  if (days < 30) return `Postada há ${days} dia${days > 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Postada há ${months} ${months > 1 ? "meses" : "mês"}`;
  const years = Math.floor(months / 12);
  return `Postada há ${years} ano${years > 1 ? "s" : ""}`;
}
