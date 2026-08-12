import * as xlsx from "xlsx";
import * as fs from "fs";

export interface CustosEmployee {
  status: string;
  registrationNumber: string;
  department: string;
  name: string;
  nameNormalized: string;
  role: string;
  careerPlan: string;
  costCenter: string;
  baseSalary: number;
  benefits: string;
  contractType: string;
}

function normalizeName(name: string): string {
  if (!name) return "";
  return name.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

export function parseCustosExcel(filePath: string): CustosEmployee[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`[WARN] Custos file not found at ${filePath}`);
    return [];
  }

  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  
  // Leitura crua da planilha
  // header:1 devolve cada linha como array de células cruas.
  const rows: unknown[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  const employees: CustosEmployee[] = [];

  // A tabela real de custos começa na linha 4 (índice 3 ou 4)
  // Cabeçalho real: ATIVO | Cod | Setor | Nome | CARGO ...
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 5) continue;

    const status = String(row[0] || "").trim().toUpperCase();
    if (status !== "ATIVO" && status !== "INATIVO") continue;

    const cod = String(row[1] || "").trim();
    if (!cod || cod.toLowerCase() === "pj") {
      // Alguns são apenas 'PJ' sem código, vamos aceitar se tiver nome
      if (!row[3]) continue;
    }

    const nameRaw = String(row[3] || "");
    const baseSal = parseFloat(String(row[10] ?? "")) || 0;

    employees.push({
      status: status,
      registrationNumber: cod,
      department: String(row[2] || ""),
      name: nameRaw,
      nameNormalized: normalizeName(nameRaw),
      role: String(row[4] || ""),
      careerPlan: String(row[6] || ""),
      costCenter: String(row[8] || ""),
      baseSalary: baseSal,
      benefits: String(row[20] || ""),
      contractType: String(row[21] || "CLT")
    });
  }

  return employees;
}
