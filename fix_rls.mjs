import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Mesma lógica de benefitClassification.ts
function classifyBenefit(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("farm") || n.includes("convênio com farmácia") || n.includes("convenio com farmacia")) return "farmacia";
  if (n.includes("odonto") || n.includes("dental") || n.includes("dentária") || n.includes("dentaria")) return "odonto";
  if (n.includes("sulcl") || n.includes("sul clinica") || n.includes("saude") || n.includes("saúde") || n.includes("médico") || n.includes("medico") || n.includes("hospital")) return "saude";
  return "outro";
}

function diffDays(d1, d2) {
  return Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));
}

async function main() {
  const { data: emps } = await s.from("employees").select("id, name, status, admission_date").not("admission_date", "is", null);
  const { data: bens } = await s.from("employee_benefits").select("employee_id, benefit_name");
  const { data: existingIgnores } = await s.from("benefit_ignores").select("employee_id");
  const alreadyIgnored = new Set((existingIgnores || []).map(i => i.employee_id));

  const now = new Date();
  const activeStatuses = ["Ativo", "Férias", "Afastado"];

  // === INCLUSÕES PENDENTES: ativos >90 dias sem saúde, odonto OU farmácia ===
  const toIgnore = (emps || []).filter(emp => {
    if (!activeStatuses.includes(emp.status)) return false;
    if (alreadyIgnored.has(emp.id)) return false;
    const days = diffDays(now, new Date(emp.admission_date));
    if (days <= 90) return false;
    const empBens = (bens || []).filter(b => b.employee_id === emp.id);
    const hasSaude = empBens.some(b => classifyBenefit(b.benefit_name) === "saude");
    const hasOdonto = empBens.some(b => classifyBenefit(b.benefit_name) === "odonto");
    const hasFarmacia = empBens.some(b => classifyBenefit(b.benefit_name) === "farmacia");
    return !hasSaude || !hasOdonto || !hasFarmacia;
  });

  console.log(`Inclusoes pendentes encontradas: ${toIgnore.length}`);
  if (toIgnore.length > 0) {
    // Inserir em lotes de 100
    for (let i = 0; i < toIgnore.length; i += 100) {
      const batch = toIgnore.slice(i, i + 100);
      const { error } = await s.from("benefit_ignores").insert(batch.map(emp => ({ employee_id: emp.id })));
      if (error) { console.log("Erro ao inserir:", error.message); break; }
    }
    await s.from("benefit_audit_logs").insert(toIgnore.map(emp => ({
      employee_id: emp.id,
      action_type: "IGNORE_ALL",
      benefit_details: `Elegibilidade ignorada via script administrativo (${emp.name})`,
      previous_payload: { employee_id: emp.id, employee_name: emp.name },
    })));
    console.log(`OK: ${toIgnore.length} ignorados.`);
  }

  // === CORTES: desligados com benefícios ===
  const dismissed = (emps || []).filter(emp => emp.status === "Desligado");
  const dismissedWithBens = dismissed.filter(emp => (bens || []).some(b => b.employee_id === emp.id));

  console.log(`\nEx-colaboradores com beneficios: ${dismissedWithBens.length}`);
  for (const emp of dismissedWithBens) {
    const empBens = (bens || []).filter(b => b.employee_id === emp.id);
    console.log(` - ${emp.name}: ${empBens.map(b => b.benefit_name).join(", ")}`);
    await s.from("benefit_audit_logs").insert({
      employee_id: emp.id,
      action_type: "REMOVE_BENEFIT",
      benefit_details: `Corte Pos-Demissao: ${empBens.length} beneficio(s) de ${emp.name}`,
      previous_payload: empBens,
    });
    await s.from("employee_benefits").delete().eq("employee_id", emp.id);
  }

  console.log("\nConcluido! Todas as notificacoes de beneficios foram tratadas.");
}

main().catch(console.error);
