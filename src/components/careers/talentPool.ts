import { createClient } from "@/utils/supabase/client";
import type { Career } from "./types";

// A Publicação do pool geral é invisível (status 'Espontanea'), então não vem em nenhuma
// listagem de vagas: só o id dela, por RPC. Sem id, quem chama não mostra o botão — melhor
// faltar o botão do que oferecer um envio que o banco vai recusar.
export async function fetchTalentPoolJob(): Promise<Career | null> {
  const { data } = await createClient().rpc("talent_pool_opening");
  if (!data) return null;
  return {
    id: data as string,
    status: "Espontanea",
    cost_center: null,
    contract_type: null,
    target_date: null,
    observations: null,
    created_at: new Date().toISOString(),
    department: null,
    salary_min: null,
    salary_max: null,
    seniority: null,
    work_mode: null,
    is_pcd_eligible: false,
    affirmative_tags: [],
    profile: null,
  };
}
