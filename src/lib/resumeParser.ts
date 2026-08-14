// Leitura de currículo sem IA, calibrada no PDF exportado pela Sólides.
//
// O PDF da Sólides usa layout de duas colunas na parte de dados pessoais
// (colunas ancoradas em x=30 e x=303). O pdf.js entrega os itens sem nenhuma
// pista de coluna, então rótulo e valor das duas colunas colam
// ("Data de nascimentoCPF" / "24/06/2002600.889.080-97"). itemsToText separa as
// colunas por TAB olhando o espaço horizontal entre itens, e parseSolidesResume
// lê o texto já tabulado.

// Compatível com TextItem e TextMarkedContent do pdf.js (marcações não têm str
// e são ignoradas).
export type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  type?: string;
};

export type ParsedExperience = {
  id: string;
  role: string;
  company: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  description: string;
};

export type ParsedAcademic = {
  id: string;
  course: string;
  institution: string;
  start_date: string;
  end_date: string;
  in_progress: boolean;
};

export type ParsedResume = {
  name: string;
  email: string;
  phone: string;
  role: string;
  age: string;
  location: string;
  education: string;
  professional_summary: string;
  experience_summary: string;
  cnh: string;
  cnh_category: string;
  has_cnh: boolean;
  cnh_categories: string[];
  birth_date: string;
  cpf: string;
  gender: string;
  address: string;
  marital_status: string;
  birthplace: string;
  secondary_phone: string;
  secondary_email: string;
  salary_expectation: string;
  race_declaration: string;
  sexual_orientation: string;
  gender_identity: string;
  academic_list: ParsedAcademic[];
  experience_list: ParsedExperience[];
};

// Dentro de uma linha real o vão entre itens é 0pt; na fronteira de coluna
// passa de 100pt. 10pt separa os dois casos com folga.
const COLUMN_GAP = 10;
const PAGE_FOOTER = /^\d+\s*\/\s*\d+$/;
const NOT_INFORMED = /^(não informado|nao informado|não informada|-)$/i;

const norm = (value: string) =>
  value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const clean = (value: string | undefined) => {
  const trimmed = (value ?? "").trim();
  return NOT_INFORMED.test(trimmed) ? "" : trimmed;
};

/** Converte os itens de uma página do pdf.js em texto, preservando colunas com TAB. */
export function itemsToText(items: PdfTextItem[]): string {
  const sorted = [...items].sort((a, b) => {
    const yDiff = (b.transform?.[5] ?? 0) - (a.transform?.[5] ?? 0);
    return Math.abs(yDiff) > 2 ? yDiff : (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0);
  });

  const lines: string[] = [];
  let line = "";
  let lastY: number | undefined;
  let lastRight: number | undefined;

  const flush = () => {
    const trimmed = line.replace(/[ \t]+$/, "");
    if (trimmed.trim() && !PAGE_FOOTER.test(trimmed.trim())) lines.push(trimmed);
    line = "";
  };

  for (const item of sorted) {
    if (item.str === undefined) continue;
    const x = item.transform?.[4];
    const y = item.transform?.[5];

    if (lastY !== undefined && y !== undefined && Math.abs(lastY - y) > 2) {
      flush();
      lastRight = undefined;
    } else if (lastRight !== undefined && x !== undefined && x - lastRight > COLUMN_GAP) {
      line += "\t";
    }

    line += item.str;
    if (y !== undefined) lastY = y;
    if (x !== undefined) lastRight = x + (item.width ?? 0);
  }
  flush();

  return lines.join("\n");
}

// Rótulo (normalizado) -> chave interna do mapa de campos.
const LABELS: Record<string, string> = {
  "pretensao salarial": "salary",
  "possui cnh?": "cnh",
  "possui cnh": "cnh",
  "categoria da cnh": "cnh_category",
  "data de nascimento": "birth_date",
  cpf: "cpf",
  email: "email",
  "e-mail": "email",
  "email secundario": "secondary_email",
  "e-mail secundario": "secondary_email",
  telefone: "phone",
  celular: "mobile",
  sexo: "gender",
  "raca/cor": "race",
  "raca / cor": "race",
  "orientacao sexual": "sexual_orientation",
  genero: "gender_identity",
  cidade: "city",
  pais: "country",
  endereco: "address",
  "estado civil": "marital_status",
  naturalidade: "birthplace",
  "cargo(s) de interesse": "role",
  "cargo de interesse": "role",
  "ano de conclusao": "graduation_year",
  descricao: "description",
  periodo: "period",
};

const SECTIONS = [
  "Resumo profissional",
  "Experiência profissional",
  "Formação",
  "Cursos e certificações",
  "Habilidades",
  "Idiomas",
  "Informações adicionais",
  "Informações pessoais",
  "Diversidade",
  "Endereço",
];
const SECTION_KEYS = new Set(SECTIONS.map(norm));

const isUpperLine = (line: string) =>
  line.length > 2 && line === line.toUpperCase() && /[A-ZÀ-ÝĀ-Ž]/.test(line);

const isLabel = (cell: string) => Boolean(LABELS[norm(cell)]);

function applyPeriod(entry: ParsedExperience, line: string) {
  const range = line.match(
    /(\d{2}\/\d{4}|\d{4})\s*(?:até|ate|a|-|–)\s*(o momento|atualmente|atual|hoje|\d{2}\/\d{4}|\d{4})/i,
  );
  if (range) {
    entry.start_date = range[1];
    if (/momento|atual|hoje/i.test(range[2])) {
      entry.is_current = true;
      entry.end_date = "";
    } else {
      entry.end_date = range[2];
    }
    return;
  }
  const single = line.match(/(\d{2}\/\d{4}|\d{4})/);
  if (single) entry.start_date = single[1];
  if (/momento|atual|hoje/i.test(line)) entry.is_current = true;
}

function parseExperiences(lines: string[]): ParsedExperience[] {
  const out: ParsedExperience[] = [];
  let current: ParsedExperience | null = null;
  let mode: "role" | "company" | "description" | "period" = "role";

  const addDescription = (text: string) => {
    if (!current) return;
    current.description = current.description ? `${current.description} ${text}` : text;
  };

  for (const raw of lines) {
    const line = raw.replace(/\t/g, " ").trim();
    if (!line) continue;
    const key = LABELS[norm(line)];

    if (key === "description") {
      mode = "description";
      continue;
    }
    if (key === "period") {
      mode = "period";
      continue;
    }
    if (mode === "period" && current) {
      applyPeriod(current, line);
      mode = "role";
      continue;
    }
    if (mode === "company" && current) {
      current.company = clean(line);
      mode = "description";
      continue;
    }
    if (isUpperLine(line) || !current) {
      current = {
        id: String(out.length + 1),
        role: clean(line),
        company: "",
        start_date: "",
        end_date: "",
        is_current: false,
        description: "",
      };
      out.push(current);
      mode = "company";
      continue;
    }
    addDescription(line);
  }

  return out.filter((entry) => entry.role);
}

function parseAcademics(lines: string[]): ParsedAcademic[] {
  const out: ParsedAcademic[] = [];
  let current: ParsedAcademic | null = null;
  let mode: "course" | "institution" | "year" = "course";
  const currentYear = new Date().getFullYear();

  for (const raw of lines) {
    const line = raw.replace(/\t/g, " ").trim();
    if (!line) continue;
    const key = LABELS[norm(line)];

    if (key === "graduation_year" || key === "period") {
      mode = "year";
      continue;
    }
    if (mode === "year" && current) {
      const range = line.match(/(\d{2}\/\d{4}|\d{4})\s*(?:até|ate|a|-|–)\s*(\d{2}\/\d{4}|\d{4})/i);
      if (range) {
        current.start_date = range[1];
        current.end_date = range[2];
      } else {
        const year = line.match(/(\d{2}\/\d{4}|\d{4})/);
        if (year) current.end_date = year[1];
      }
      mode = "course";
      continue;
    }
    if (mode === "institution" && current) {
      // "UCPel - Superior Completo": instituição antes do traço, nível vai pro curso.
      const [institution, ...rest] = line.split(/\s+[-–]\s+/);
      current.institution = clean(institution);
      const level = rest.join(" - ").trim();
      if (level) {
        current.course = current.course ? `${current.course} (${level})` : level;
        if (/incompleto|cursando|em andamento/i.test(level)) current.in_progress = true;
      }
      mode = "course";
      continue;
    }
    if (isUpperLine(line) || !current) {
      current = {
        id: String(out.length + 1),
        course: clean(line),
        institution: "",
        start_date: "",
        end_date: "",
        in_progress: false,
      };
      out.push(current);
      mode = "institution";
      continue;
    }
  }

  for (const entry of out) {
    const endYear = Number(entry.end_date.slice(-4));
    if (endYear && endYear > currentYear) entry.in_progress = true;
  }

  return out.filter((entry) => entry.course);
}

/** Lê o texto de um currículo (padrão Sólides) e devolve os campos no mesmo shape do caminho de IA. */
export function parseSolidesResume(text: string): ParsedResume {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .filter((line) => line.trim() && !PAGE_FOOTER.test(line.trim()));

  // 1) Pares rótulo/valor: uma linha só de rótulos seguida da linha de valores.
  const fields: Record<string, string> = {};
  const consumed = new Set<number>();
  for (let i = 0; i < lines.length - 1; i++) {
    if (consumed.has(i)) continue;
    const labelCells = lines[i].split("\t").map((cell) => cell.trim());
    if (!labelCells.every((cell) => cell && isLabel(cell))) continue;
    const valueCells = lines[i + 1].split("\t").map((cell) => cell.trim());
    if (valueCells.length !== labelCells.length) continue;
    // A linha seguinte também é de rótulos => a atual era título de seção.
    if (valueCells.some((cell) => cell && isLabel(cell))) continue;

    labelCells.forEach((label, idx) => {
      const key = LABELS[norm(label)];
      const value = clean(valueCells[idx]);
      if (key && value && !fields[key]) fields[key] = value;
    });
    consumed.add(i);
    consumed.add(i + 1);
    i++;
  }

  // 2) Seções.
  const sections: Record<string, string[]> = {};
  let currentSection = "";
  lines.forEach((line, index) => {
    if (!line.includes("\t") && SECTION_KEYS.has(norm(line))) {
      currentSection = norm(line);
      if (!sections[currentSection]) sections[currentSection] = [];
      consumed.add(index);
      return;
    }
    if (currentSection) (sections[currentSection] ??= []).push(line);
  });

  const sectionLines = (name: string) => sections[norm(name)] ?? [];

  const headerLines = lines.slice(0, lines.findIndex((line) => SECTION_KEYS.has(norm(line))) + 1 || 6);
  const name = clean(headerLines[0]);
  const ageMatch = text.match(/(?<![\d/])\b([1-9][0-9])\s*anos/i);
  // Cidade/UF só dentro de uma linha: com \s a regex atravessava a quebra e
  // colava a linha da idade ("anosPelotas - RS").
  const locationMatch = lines
    .map((line) => line.trim().match(/^([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .']*?)\s*[-/,]\s*([A-Z]{2})$/i))
    .find(Boolean);
  const phoneMatch = text.match(/(\(?\d{2}\)?\s*(?:9\s*)?\d{4,5}[-\s]?\d{4})/);
  const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/);

  // Cargo pretendido: linha do cabeçalho que não é nome, idade, cidade, telefone ou e-mail.
  const headerRole =
    fields.role ||
    clean(
      headerLines
        .slice(1)
        .find(
          (line) =>
            !SECTION_KEYS.has(norm(line)) &&
            !/\d/.test(line) &&
            !/@/.test(line) &&
            !/\s-\s[A-Z]{2}$/.test(line),
        ) ?? "",
    );

  const academic_list = parseAcademics(sectionLines("Formação"));
  const courses = sectionLines("Cursos e certificações")
    .map((line) => clean(line))
    .filter(Boolean);
  // Campo de uma linha no formulário: resumo legível em vez do bloco cru do PDF.
  const education = [
    academic_list
      .map((item) => [item.course, item.institution].filter(Boolean).join(" - "))
      .join("; "),
    courses.length ? `Cursos: ${courses.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join(" | ")
    .trim();

  const salary = fields.salary
    ? /r\$/i.test(fields.salary)
      ? fields.salary
      : `R$ ${fields.salary}`
    : "";

  const city = fields.city || "";
  const location = locationMatch
    ? `${locationMatch[1].trim()} - ${locationMatch[2].toUpperCase()}`
    : city;

  return {
    name,
    email: fields.email || (emailMatch ? emailMatch[1] : ""),
    phone: fields.phone || fields.mobile || (phoneMatch ? phoneMatch[1] : ""),
    role: headerRole,
    age: ageMatch ? ageMatch[1] : "",
    location,
    education,
    professional_summary: sectionLines("Resumo profissional").join(" ").trim(),
    experience_summary: sectionLines("Experiência profissional").join("\n").trim(),
    cnh: fields.cnh || (fields.cnh_category ? "Sim" : ""),
    cnh_category: fields.cnh_category || "",
    has_cnh: /^sim$/i.test(fields.cnh || "") || Boolean(fields.cnh_category),
    cnh_categories: fields.cnh_category
      ? fields.cnh_category.split(/[,/;]/).map((item) => item.trim()).filter(Boolean)
      : [],
    birth_date: fields.birth_date || "",
    cpf: fields.cpf || "",
    gender: fields.gender || "",
    address: fields.address || "",
    marital_status: fields.marital_status || "",
    birthplace: fields.birthplace || "",
    secondary_phone: fields.phone && fields.mobile && fields.phone !== fields.mobile ? fields.mobile : "",
    secondary_email: fields.secondary_email || "",
    salary_expectation: salary,
    race_declaration: fields.race || "",
    sexual_orientation: fields.sexual_orientation || "",
    gender_identity: fields.gender_identity || "",
    academic_list,
    experience_list: parseExperiences(sectionLines("Experiência profissional")),
  };
}
