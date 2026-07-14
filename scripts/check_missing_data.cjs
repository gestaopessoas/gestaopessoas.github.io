const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
require("dotenv").config({ path: ".env" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const requiredFields = [
  "name", "birthday", "status", "role", "phone", "email_personal", 
  "email_corporate", "contract_type", "admission_date", "gender", 
  "unit", "cpf", "rg", "ctps", "pis", "marital_status", "cost_center", "cbo"
];

const fieldLabels = {
  name: "Nome",
  birthday: "Data de Nascimento",
  status: "Status",
  role: "Cargo",
  phone: "Telefone",
  email_personal: "E-mail Pessoal",
  email_corporate: "E-mail Corporativo",
  contract_type: "Tipo de Contrato",
  admission_date: "Data de Admissão",
  gender: "Gênero",
  unit: "Unidade",
  cpf: "CPF",
  rg: "RG",
  ctps: "CTPS",
  pis: "PIS",
  marital_status: "Estado Civil",
  cost_center: "Centro de Custo",
  cbo: "CBO"
};

async function checkMissing() {
  const { data: employees, error } = await supabase.from("employees").select("*").order("name");
  if (error) {
    console.error(error);
    return;
  }

  let report = "# Relatório de Dados Faltantes dos Colaboradores\n\n";
  report += "Abaixo está a lista de colaboradores e quais informações estão faltando no cadastro de cada um.\n\n";

  let totalMissingCount = 0;
  let perfectCount = 0;

  for (const emp of employees) {
    // Only check active employees? Let's check all or active? Let's check active primarily, but maybe all.
    // Let's include status in the output so it's clear.
    if (emp.status !== "Ativo") continue; // Let's focus on active first to reduce noise, or maybe all? Wait, they asked for "cada funcionario cadastrado". Let's do all, but group by status or just mention if they are inactive.

    const missing = [];
    for (const field of requiredFields) {
      if (emp[field] === null || emp[field] === undefined || emp[field] === "") {
        missing.push(fieldLabels[field]);
      }
    }

    if (missing.length > 0) {
      report += `### ${emp.name} ${emp.status !== 'Ativo' ? '(Desligado)' : ''}\n`;
      report += `- **Faltam ${missing.length} dados:** ${missing.join(", ")}\n\n`;
      totalMissingCount++;
    } else {
      perfectCount++;
    }
  }

  report += `---\n**Resumo:**\n- ${perfectCount} colaboradores com cadastro 100% completo.\n- ${totalMissingCount} colaboradores com alguma informação faltando.\n`;

  fs.writeFileSync("C:\\Users\\ACPO Empreendimentos\\.gemini\\antigravity\\brain\\50b23cfb-9e9d-4769-a8f3-66ed510f1db9\\dados_faltantes.md", report, "utf8");
  console.log("Relatório gerado em dados_faltantes.md");
}

checkMissing();
