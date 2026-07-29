import * as xlsx from "xlsx";
import * as fs from "fs";

export interface RgsEmployee {
  cpf: string;
  name: string;
  nameNormalized: string;
  registrationNumber?: string;
  role?: string;
  department?: string;
  admissionDate?: Date;
  raw: any;
}

function normalizeName(name: string): string {
  if (!name) return "";
  return name.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

function normalizeCpf(cpf: string | number): string {
  if (!cpf) return "";
  return String(cpf).replace(/\D/g, "").padStart(11, "0");
}

export function parseRgsExcel(filePath: string): RgsEmployee[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`[WARN] RGS file not found at ${filePath}`);
    return [];
  }

  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  
  // Leitura com cabeçalhos reais. Precisamos encontrar as colunas.
  // Assumimos que o RGS tem colunas "Nome", "CPF", "Matrícula" etc.
  // Se os nomes das colunas variarem, precisamos mapear ou usar índices aproximados.
  const rows: any[] = xlsx.utils.sheet_to_json(sheet);
  
  return rows.map((row) => {
    // Tenta encontrar colunas pelas chaves
    const getVal = (possibleKeys: string[]) => {
      for (const k of Object.keys(row)) {
        const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (possibleKeys.some(pk => kNorm.includes(pk))) {
          return row[k];
        }
      }
      return null;
    };

    const cpfRaw = getVal(["cpf"]);
    const nameRaw = getVal(["nome", "name"]);
    const regRaw = getVal(["matr", "codigo", "registro"]);
    const roleRaw = getVal(["cargo", "funcao"]);
    const deptRaw = getVal(["setor", "departamento"]);

    return {
      cpf: cpfRaw ? normalizeCpf(cpfRaw) : "",
      name: String(nameRaw || ""),
      nameNormalized: normalizeName(String(nameRaw || "")),
      registrationNumber: regRaw ? String(regRaw) : undefined,
      role: roleRaw ? String(roleRaw) : undefined,
      department: deptRaw ? String(deptRaw) : undefined,
      raw: row
    };
  }).filter(e => e.nameNormalized.length > 0);
}
