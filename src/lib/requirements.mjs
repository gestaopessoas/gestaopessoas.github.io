// Requisitos do perfil de competência de uma vaga (Mínimo / Desejável), em blocos
// estruturados na tela mas gravados como texto plano em `required_requirements` /
// `desired_requirements` (colunas `text`, sem migration -- issue #161).
//
// `parseRequirements` também entende o formato antigo: `job_profiles.competencies`/`knowledge`
// vem com um item por linha, às vezes duplicado (ex.: perfil PEDREIRO repete a lista inteira),
// então toda leitura de chip passa por dedupe.

const REQUIRED_LABELS = {
  "escolaridade minima": "education",
  "experiencia minima": "experience",
  "cnh": "cnh",
};

const DESIRED_LABELS = {
  "escolaridade desejavel": "education",
  "experiencia desejavel": "experience",
  "conhecimentos": "knowledge",
  "competencias": "competencies",
};

const CHIP_FIELDS = new Set(["knowledge", "competencies"]);

function normalize(text) {
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

// Quebra texto em itens de chip. Separador é ";" ou quebra de linha -- nunca vírgula, que
// aparece dentro do próprio item ("Excel, Word"). Remove vazio e duplicata (comparação sem
// acento/caixa), mantendo a primeira grafia digitada.
export function splitItems(text) {
  const seen = new Set();
  const items = [];
  for (const raw of String(text ?? "").split(/[\n;]/)) {
    const item = raw.trim();
    if (!item) continue;
    const key = normalize(item);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}

function emptyBlock(kind) {
  return kind === "required"
    ? { education: "", experience: "", cnh: "", other: "" }
    : { education: "", experience: "", knowledge: [], competencies: [], other: "" };
}

// Linha "Rótulo: valor". `labels` já vem com a chave normalizada (sem acento/caixa).
function matchLabel(line, labels) {
  const idx = line.indexOf(":");
  if (idx === -1) return null;
  const field = labels[normalize(line.slice(0, idx))];
  if (!field) return null;
  return { field, value: line.slice(idx + 1).trim() };
}

/**
 * Texto gravado -> bloco estruturado. `kind` é "required" ou "desired".
 *
 * Formato novo: uma linha "Rótulo: valor" por campo, chips juntos com "; ".
 * Formato antigo: linha "Conhecimentos: primeiroItem" seguida de itens soltos, um por linha,
 * até a próxima linha com rótulo conhecido. Linha sem rótulo e fora dessa continuação vai para
 * "Outros" -- nunca perde dado.
 */
export function parseRequirements(text, kind) {
  const labels = kind === "required" ? REQUIRED_LABELS : DESIRED_LABELS;
  const block = emptyBlock(kind);
  const otherLines = [];
  let chipContinuation = null;

  for (const rawLine of String(text ?? "").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = matchLabel(line, labels);
    if (match) {
      if (CHIP_FIELDS.has(match.field)) {
        block[match.field] = splitItems(match.value);
        chipContinuation = match.field;
      } else {
        block[match.field] = match.value;
        chipContinuation = null;
      }
      continue;
    }

    if (chipContinuation) {
      const seen = new Set(block[chipContinuation].map((item) => normalize(item)));
      for (const item of splitItems(line)) {
        const key = normalize(item);
        if (seen.has(key)) continue;
        seen.add(key);
        block[chipContinuation].push(item);
      }
      continue;
    }

    otherLines.push(line);
  }

  block.other = otherLines.join("\n");
  return block;
}

/** Bloco estruturado -> texto plano. Campo vazio não gera linha; "Outros" sempre no fim. */
export function serializeRequirements(block, kind) {
  const lines = [];
  if (kind === "required") {
    if (block.education) lines.push(`Escolaridade mínima: ${block.education}`);
    if (block.experience) lines.push(`Experiência mínima: ${block.experience}`);
    if (block.cnh) lines.push(`CNH: ${block.cnh}`);
  } else {
    if (block.education) lines.push(`Escolaridade desejável: ${block.education}`);
    if (block.experience) lines.push(`Experiência desejável: ${block.experience}`);
    if (block.knowledge?.length) lines.push(`Conhecimentos: ${block.knowledge.join("; ")}`);
    if (block.competencies?.length) lines.push(`Competências: ${block.competencies.join("; ")}`);
  }
  if (block.other) lines.push(block.other);
  return lines.join("\n");
}
