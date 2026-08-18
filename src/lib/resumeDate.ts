// Normalização de datas de currículo para ISO.
//
// Módulo separado e SEM IMPORTS de propósito: assim o teste (resumeDate.test.mjs) consegue
// carregá-lo direto pelo type stripping do Node, sem resolver a cadeia de imports do app.

// Meses em português, por prefixo de 3 letras (cobre "jan", "jan.", "janeiro", "JANEIRO").
const MONTHS_PT: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Converte datas de currículo para ISO "YYYY-MM-DD". Retorna null quando não reconhece o
 * formato — melhor gravar data ausente do que uma string que quebra o insert nas colunas
 * `date` de candidate_educations / candidate_experiences.
 *
 * Rede de segurança do prompt de IA (que já pede ISO): modelos ocasionalmente devolvem o
 * formato cru do currículo. Os casos aqui saíram dos currículos reais em Documents/Curriculos.
 */
export function normalizeResumeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Descarta a duração entre parênteses do export Sólides. Corta no primeiro "(" em vez de
  // casar o par: o texto real vem com parênteses aninhados — "06/2025 (3 mes(es))" — e uma
  // regex de par deixava o ")" solto no fim, fazendo a data inteira cair para null.
  const value = raw.split("(")[0].replace(/\s+/g, " ").trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  if (/^\d{4}$/.test(value)) return `${value}-01-01`;

  // Semestre acadêmico: "2026/1" -> janeiro, "2026/2" -> julho.
  const semester = value.match(/^(\d{4})\/([12])$/);
  if (semester) return `${semester[1]}-${semester[2] === "1" ? "01" : "07"}-01`;

  // MM/YYYY (também aceita "." e "-" como separador: "05.2025", "05-2025").
  const monthYear = value.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (monthYear) {
    const month = Number(monthYear[1]);
    if (month >= 1 && month <= 12) return `${monthYear[2]}-${pad(month)}-01`;
  }

  // DD/MM/YYYY e DD.MM.YYYY. Ano de 2 dígitos ("03/03/14") vira 20xx.
  const dmy = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${pad(month)}-${pad(day)}`;
    }
  }

  // Mês por extenso ou abreviado + ano: "ago. 2025", "Outubro de 2017", "NOVEMBRO 2025".
  const named = value.match(/^([a-zà-ú]{3,})\.?\s*(?:de\s+)?(\d{4})$/i);
  if (named) {
    const month = MONTHS_PT[named[1].slice(0, 3).toLowerCase()];
    if (month) return `${named[2]}-${pad(month)}-01`;
  }

  // "dez/2025", "jan/26" — mês abreviado com barra.
  const namedSlash = value.match(/^([a-zà-ú]{3,})\.?\/(\d{2}|\d{4})$/i);
  if (namedSlash) {
    const month = MONTHS_PT[namedSlash[1].slice(0, 3).toLowerCase()];
    const year = namedSlash[2].length === 2 ? 2000 + Number(namedSlash[2]) : Number(namedSlash[2]);
    if (month) return `${year}-${pad(month)}-01`;
  }

  return null;
}
