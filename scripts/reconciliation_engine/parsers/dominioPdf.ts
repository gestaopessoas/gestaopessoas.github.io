import * as fs from "fs";
import * as path from "path";
import pdf from "pdf-parse";

export interface DominioEmployee {
  registrationNumber: string;
  name: string;
  nameNormalized: string;
  cpf?: string;
  role?: string;
  admissionDate?: string;
  costCenter?: string;
  status?: string;
  rawLine: string;
  sourceFile: string;
}

function normalizeName(name: string): string {
  if (!name) return "";
  return name.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

function normalizeCpf(cpf: string): string {
  if (!cpf) return "";
  return cpf.replace(/\D/g, "").padStart(11, "0");
}

export async function parseDominioPdf(filePath: string): Promise<DominioEmployee[]> {
  if (!fs.existsSync(filePath)) {
    console.warn(`[WARN] File not found at ${filePath}`);
    return [];
  }

  try {
    let lines: string[] = [];
    
    // Check if there is an OCR .txt file next to it
    const txtPath = filePath.replace(/\.pdf$/i, ".txt");
    if (fs.existsSync(txtPath)) {
      console.log(`         -> (Usando arquivo de texto OCR: ${path.basename(txtPath)})`);
      const text = fs.readFileSync(txtPath, "utf-8");
      lines = text.split("\n");
    } else if (filePath.toLowerCase().endsWith(".pdf")) {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      lines = data.text.split("\n");
    } else {
      const text = fs.readFileSync(filePath, "utf-8");
      lines = text.split("\n");
    }

    const employees: DominioEmployee[] = [];

    // Regex to detect CPF format xxx.xxx.xxx-xx
    const cpfRegex = /\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/;
    
    // Regex to detect a line starting with a code and a name (e.g. "19733 ADAO PAULO")
    const employeeLineRegex = /^(\d{4,6})\s+([A-ZÀ-Ú\s]+)\s+(.*)$/i;

    for (const line of lines) {
      const match = line.trim().match(employeeLineRegex);
      if (match) {
        const registrationNumber = match[1];
        let nameRaw = match[2].trim();
        const restOfLine = match[3];
        
        // Cuidado com palavras que podem ser cargo coladas ao nome, mas vamos assumir que o regex separa razoavelmente bem.
        // Tenta achar o CPF no resto da linha
        let cpf = undefined;
        const cpfMatch = line.match(cpfRegex);
        if (cpfMatch) {
          cpf = normalizeCpf(cpfMatch[1]);
        }

        // Tenta achar data de admissao dd/mm/yyyy
        let admissionDate = undefined;
        const dateMatch = line.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
        if (dateMatch) {
          admissionDate = dateMatch[1];
        }

        // Se o nome cruzar com o cargo, tentamos limpar a sujeira (Heurística básica)
        if (nameRaw.includes("SERVENTE")) nameRaw = nameRaw.replace("SERVENTE", "").trim();
        if (nameRaw.includes("PEDREIRO")) nameRaw = nameRaw.replace("PEDREIRO", "").trim();
        if (nameRaw.includes("AUXILIAR")) nameRaw = nameRaw.replace(/AUXILIAR.*/, "").trim();

        employees.push({
          registrationNumber,
          name: nameRaw,
          nameNormalized: normalizeName(nameRaw),
          cpf,
          admissionDate,
          rawLine: line.trim(),
          sourceFile: filePath
        });
      }
    }

    return employees;
  } catch (error) {
    console.error(`[ERROR] Failed to parse PDF at ${filePath}:`, error instanceof Error ? error.message : error);
    return [];
  }
}
