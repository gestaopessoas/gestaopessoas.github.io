import * as fs from "fs";

export interface SolidesEmployee {
  name: string;
  nameNormalized: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  gender?: string;
  role?: string;
  department?: string;
  raw: unknown;
}

type SolidesRawEmployee = {
  nome?: string;
  name?: string;
  email?: string;
  telefone?: string;
  celular?: string;
  cargo?: string;
  departamento?: string;
  informacoes_pessoais?: { data_nascimento?: string; genero?: string };
};

function normalizeName(name: string): string {
  if (!name) return "";
  return name.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

export function parseSolidesJson(filePath: string): SolidesEmployee[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`[WARN] JSON file not found at ${filePath}`);
    return [];
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    
    if (!Array.isArray(data)) {
      console.warn(`[WARN] JSON is not an array at ${filePath}`);
      return [];
    }

    return (data as SolidesRawEmployee[]).map((item) => {
      const nameRaw = item.nome || item.name || "";
      const personalInfo = item.informacoes_pessoais || {};
      return {
        name: nameRaw,
        nameNormalized: normalizeName(nameRaw),
        email: item.email,
        phone: item.telefone || item.celular,
        birthDate: personalInfo.data_nascimento,
        gender: personalInfo.genero,
        role: item.cargo,
        department: item.departamento,
        raw: item
      };
    }).filter(e => e.nameNormalized.length > 0);
  } catch (error) {
    console.error(`[ERROR] Failed to parse JSON at ${filePath}:`, error instanceof Error ? error.message : error);
    return [];
  }
}
