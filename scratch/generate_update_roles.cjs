const fs = require('fs');

function extractJson(filePath) {
  let content = fs.readFileSync(filePath, 'utf16le');
  if (!content.includes('<untrusted-data')) {
    content = fs.readFileSync(filePath, 'utf8');
  }
  const startMarker = ']';
  const endMarker = '[';
  const startIdx = content.indexOf('[');
  const endIdx = content.lastIndexOf(']');
  if (startIdx !== -1 && endIdx !== -1) {
    try {
      return JSON.parse(content.substring(startIdx, endIdx + 1));
    } catch(e) {
      console.error(e);
      return [];
    }
  }
  return [];
}

const profiles = extractJson('C:\\Users\\ACPO Empreendimentos\\.gemini\\antigravity\\brain\\acf67a37-12be-4432-8903-cb3b5dc303b6\\.system_generated\\steps\\654\\output.txt');
const employees = extractJson('C:\\Users\\ACPO Empreendimentos\\.gemini\\antigravity\\brain\\acf67a37-12be-4432-8903-cb3b5dc303b6\\.system_generated\\steps\\658\\output.txt');

function normalizeString(str) {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const normalizedProfiles = profiles.map(p => ({
  ...p,
  normTitle: normalizeString(p.title)
}));

const customMappings = {
  "coord compras": "Coordenador(a) Compras",
  "auxiliar administrativo (obras)": "Auxiliar Administrativo - Financeiro",
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

let sqlUpdates = "";
let updated = 0;

for (const emp of employees) {
  if (!emp.role) continue;

  const normRole = normalizeString(emp.role);
  let matchedProfile = normalizedProfiles.find(p => p.normTitle === normRole);
  
  if (!matchedProfile) {
    matchedProfile = normalizedProfiles.find(p => 
      p.normTitle.includes(normRole) || normRole.includes(p.normTitle)
    );
  }
  
  let targetTitle = matchedProfile ? matchedProfile.title : null;
  
  const manualMatch = customMappings[normRole] || Object.keys(customMappings).find(k => normRole.includes(k));
  if (manualMatch) {
    targetTitle = customMappings[manualMatch] || manualMatch;
  }

  if (targetTitle && targetTitle !== emp.role) {
    sqlUpdates += `UPDATE employees SET role = '${targetTitle.replace(/'/g, "''")}' WHERE id = '${emp.id}';\n`;
    updated++;
  }
}

fs.writeFileSync('C:\\Users\\ACPO Empreendimentos\\Documents\\Github\\gestaopessoas.github.io\\scratch\\update_roles.sql', sqlUpdates);
console.log(`Wrote ${updated} updates to update_roles.sql`);
