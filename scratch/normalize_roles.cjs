require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function normalizeString(str) {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

async function main() {
  console.log("Fetching job profiles...");
  const { data: profiles, error: profilesError } = await supabase.from("job_profiles").select("id, title");
  if (profilesError) {
    console.error("Error fetching profiles:", profilesError);
    return;
  }

  console.log("Fetching employees...");
  const { data: employees, error: employeesError } = await supabase.from("employees").select("id, name, role");
  if (employeesError) {
    console.error("Error fetching employees:", employeesError);
    return;
  }

  const normalizedProfiles = profiles.map(p => ({
    ...p,
    normTitle: normalizeString(p.title)
  }));

  console.log("Starting normalization...");
  let updatedCount = 0;
  
  // Custom manual mappings for those that don't match exactly even after normalization
  const customMappings = {
    "coord compras": "Coordenador(a) Compras",
    "auxiliar administrativo (obras)": "Auxiliar Administrativo - Financeiro", // Just a guess, or maybe leave as is if no match
    "conselho": "Presidente (Conselho)",
    "diretora adm/financeira": "Diretor(a) Administrativo(a) e Financeiro(a)",
    "diretor de operacoes": "Diretor Operacional",
    "diretor de estrategia": "Diretor Estratégico",
    "coord contábil": "Coordenador (a) Contábil",
    "coord contabil": "Coordenador (a) Contábil",
    "coord. de obras": "Coordenador de Obras",
    "tec. seg. do trabalho": "Técnico(a) em Segurança do Trabalho",
    "tec. edificacoes": "Técnico(a) em edificações - Sede",
    "aux.tec de qualidade": "Auxiliar Técnico de Qualidade",
    "coord. de manutencao": "Coordenador de Manutenção",
    "coord. de projetos": "Coordenador(a) de Projetos",
    "coord. de qualidade": "Coordenador (a) de Qualidade",
    "coord. de sms": "Coordenador(a) de SMS",
    "assistente tec de qualidade": "Assistente Técnico de Qualidade",
    "analista contabil": "Analista Contábil (Fiscal) -",
    "analista de mkt": "Analista de Marketing",
    "assistente de mkt": "Assistente de Marketing",
    "mecanico lider": "Mecânico Líder",
    "mecanico": "Mecânico",
    "pedreiro": "Pedreiro",
    "servicos gerais": "Auxiliar de Serviços Gerais",
    "aux. servicos gerais": "Auxiliar de Serviços Gerais",
    "psicologo": "Psicólogo(a) Organizacional",
    "presidente": "Presidente (Conselho)",
    "coord. financeira(o)": "Coordenador(a) Financeiro(a) -",
    "analista tecnico": "Analista Técnico(a) - Obras",
    "projetista": "Projetista - Complementar",
    "encarregado": "Encarregado de Civil",
    "estagiario": "ESTAGIÁRIO (A) ENGENHARIA CIVIL CANTEIRO",
    "coordenadora comercial": "Coordenador(a) Comercial",
    "coord comercial": "Coordenador(a) Comercial"
  };

  for (const emp of employees) {
    if (!emp.role) continue;

    const normRole = normalizeString(emp.role);
    let matchedProfile = normalizedProfiles.find(p => p.normTitle === normRole);
    
    // Fuzzy logic: check if normRole is included in normTitle or vice versa
    if (!matchedProfile) {
      matchedProfile = normalizedProfiles.find(p => 
        p.normTitle.includes(normRole) || normRole.includes(p.normTitle)
      );
    }
    
    // Custom mapping overrides
    let targetTitle = matchedProfile ? matchedProfile.title : null;
    
    // Check if we have a manual map
    const manualMatch = customMappings[normRole] || Object.keys(customMappings).find(k => normRole.includes(k));
    if (manualMatch) {
      targetTitle = customMappings[manualMatch] || manualMatch;
    }

    if (targetTitle && targetTitle !== emp.role) {
      console.log(`Updating [${emp.name}] role: "${emp.role}" -> "${targetTitle}"`);
      const { error } = await supabase.from("employees").update({ role: targetTitle }).eq("id", emp.id);
      if (error) {
        console.error(`Failed to update ${emp.name}:`, error.message);
      } else {
        updatedCount++;
      }
    } else if (!targetTitle) {
      console.log(`Could not find a match for: "${emp.role}" (Employee: ${emp.name})`);
    }
  }

  console.log(`Normalization complete. Updated ${updatedCount} employees.`);
}

main();
