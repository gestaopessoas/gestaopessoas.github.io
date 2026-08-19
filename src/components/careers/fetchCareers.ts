import { createClient } from "@/utils/supabase/client";
import type { Career } from "./types";

const FALLBACK_SELECT = "id,status,cost_center,contract_type,target_date,observations,created_at,salary_min,salary_max,seniority,work_mode,is_pcd_eligible,affirmative_tags,profile:job_profiles(title,profile_code,min_education,desired_education,min_experience,desired_experience,knowledge,activities,competencies),department:departments(name)";

export async function fetchCareers(): Promise<{ careers: Career[]; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_public_careers");

  if (error) {
    const fallback = await supabase
      .from("job_openings")
      .select(FALLBACK_SELECT)
      .eq("status", "Aberta")
      .order("created_at", { ascending: false });

    if (fallback.error) return { careers: [], error: "Não foi possível carregar vagas abertas." };

    const rows = (fallback.data ?? []) as unknown as Array<Career & {
      department: { name: string | null } | { name: string | null }[] | null;
      profile: Career["profile"] | Career["profile"][];
    }>;
    return {
      careers: rows.map((item) => ({
        ...item,
        profile: Array.isArray(item.profile) ? item.profile[0] ?? null : item.profile ?? null,
        department: Array.isArray(item.department) ? item.department[0]?.name ?? null : item.department?.name ?? null,
        affirmative_tags: item.affirmative_tags ?? [],
        is_pcd_eligible: item.is_pcd_eligible ?? false,
      })),
      error: null,
    };
  }

  return { careers: (data ?? []) as Career[], error: null };
}
