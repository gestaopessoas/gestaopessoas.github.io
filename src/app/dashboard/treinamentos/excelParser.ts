import * as XLSX from "xlsx";
import { calculateCleanAverage, calculateWeightedUtilization } from "@/utils/trainingMath.mjs";

export type SatisfactionMetrics = {
  respondents: number;
  average_score: number;
  // Pergunta (cabeçalho da coluna) -> resposta -> quantas vezes apareceu.
  // Genérico: qualquer pergunta de múltipla escolha do Excel vira uma entrada aqui,
  // sem precisar mexer no código quando o Forms ganhar novas perguntas.
  answer_distributions: Record<string, Record<string, number>>;
  feedback_likes: string[];
  feedback_improvements: string[];
  content_score?: number;
  management_support_score?: number;
  engagement_score?: number;
  weighted_utilization_score?: number;
  // Uma entrada por linha do Excel (por respondente), pra quem quiser
  // reprocessar ou cruzar dados sem depender só dos agregados acima.
  responses: TrainingResponseRow[];
};

export type TrainingResponseRow = {
  score: number | null;
  answers: Record<string, string | number>;
};

// Colunas que nunca entram na análise de distribuição: metadados ou texto livre.
// Comparados sempre contra texto já normalizado (sem acento) — por isso os
// padrões abaixo não levam acento, senão nunca dão match.
const SKIP_HEADER_PATTERNS = [
  /^id$/, /hora de inicio/, /hora de conclusao/, /^email$/, /^nome$/,
  /mais gostou/, /pode ser melhorado/, /descreveria/, /conte um pouco/,
  /proximos treinamentos/, /sugest/,
];

// Só isso fica fora da linha bruta salva por respondente — o resto (mesmo
// texto livre) entra, pra manter a linha do Excel completa.
const RAW_ROW_SKIP_PATTERNS = [/^id$/, /hora de inicio/, /hora de conclusao/];

const CONTENT_KEYWORDS = ["conteúdo", "aplicabilidade", "aplicação"];
const MANAGEMENT_KEYWORDS = ["gestão", "suporte"];
const ENGAGEMENT_KEYWORDS = ["engajamento", "feedback", "aproveitamento"];

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Converte respostas de escala Likert em texto (Ótimo/Concordo Totalmente/...) pra nota 0-10,
// pra alimentar o aproveitamento ponderado mesmo quando o Forms usa texto em vez de número.
function likertToScore(raw: string | number): number | null {
  if (typeof raw === "number") return raw >= 0 && raw <= 10 ? raw : null;
  const v = normalize(String(raw));
  if (v === "") return null;
  const asNumber = Number(v);
  if (!isNaN(asNumber) && asNumber >= 0 && asNumber <= 10) return asNumber;
  if (["otimo", "excelente"].includes(v)) return 10;
  if (v === "bom") return 7.5;
  if (["regular", "medio", "razoavel"].includes(v)) return 5;
  if (v === "ruim") return 2.5;
  if (["pessimo", "muito ruim"].includes(v)) return 0;
  if (v === "concordo totalmente") return 10;
  if (v === "concordo parcialmente") return 6.67;
  if (["nao concordo nem discordo", "neutro", "indiferente"].includes(v)) return 5;
  if (v === "discordo parcialmente") return 3.33;
  if (v === "discordo totalmente") return 0;
  return null;
}

export const parseSatisfactionExcel = async (file: File): Promise<SatisfactionMetrics> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });

        if (rows.length < 2) {
          throw new Error("O arquivo Excel está vazio ou não possui formato válido.");
        }

        const headers = (rows[0] as unknown[]).map(h => String(h || "").trim());

        let idxScore = -1;
        let idxLiked = -1;
        let idxImprove = -1;
        const contentIdxs: number[] = [];
        const managementIdxs: number[] = [];
        const engagementIdxs: number[] = [];
        const distributionIdxs: number[] = [];

        headers.forEach((h, i) => {
          if (!h) return;
          const lower = normalize(h);
          if (lower.includes("de 0 a 10") || lower.includes("nota geral")) { idxScore = i; return; }
          if (lower.includes("mais gostou")) { idxLiked = i; return; }
          if (lower.includes("pode ser melhorado")) { idxImprove = i; return; }
          if (SKIP_HEADER_PATTERNS.some(p => p.test(lower))) return;

          if (CONTENT_KEYWORDS.some(k => lower.includes(normalize(k)))) contentIdxs.push(i);
          if (MANAGEMENT_KEYWORDS.some(k => lower.includes(normalize(k)))) managementIdxs.push(i);
          if (ENGAGEMENT_KEYWORDS.some(k => lower.includes(normalize(k)))) engagementIdxs.push(i);

          // Qualquer coluna restante (não metadado, não texto livre, não nota geral)
          // é tratada como pergunta de múltipla escolha e entra na distribuição.
          distributionIdxs.push(i);
        });

        const scores: (string | number)[] = [];
        const contentScores: number[] = [];
        const managementScores: number[] = [];
        const engagementScores: number[] = [];
        const likes: string[] = [];
        const improvements: string[] = [];
        const answerDistributions: Record<string, Record<string, number>> = {};
        distributionIdxs.forEach(i => { answerDistributions[headers[i]] = {}; });
        const responses: TrainingResponseRow[] = [];
        const rawRowIdxs = headers
          .map((h, i) => ({ h, i }))
          .filter(({ h }) => h && !RAW_ROW_SKIP_PATTERNS.some(p => p.test(normalize(h))))
          .map(({ i }) => i);

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as unknown[];
          if (!row || row.length === 0) continue;

          if (idxScore !== -1 && row[idxScore] != null) scores.push(row[idxScore] as string | number);

          const rowAnswers: Record<string, string | number> = {};
          rawRowIdxs.forEach(idx => {
            if (row[idx] == null) return;
            const val = typeof row[idx] === "number" ? (row[idx] as number) : String(row[idx]).trim();
            if (val === "") return;
            rowAnswers[headers[idx]] = val;
          });
          const rowScore = idxScore !== -1 && row[idxScore] != null ? Number(row[idxScore]) : null;
          responses.push({ score: rowScore != null && !isNaN(rowScore) ? rowScore : null, answers: rowAnswers });

          contentIdxs.forEach(idx => {
            const score = row[idx] != null ? likertToScore(row[idx] as string | number) : null;
            if (score != null) contentScores.push(score);
          });
          managementIdxs.forEach(idx => {
            const score = row[idx] != null ? likertToScore(row[idx] as string | number) : null;
            if (score != null) managementScores.push(score);
          });
          engagementIdxs.forEach(idx => {
            const score = row[idx] != null ? likertToScore(row[idx] as string | number) : null;
            if (score != null) engagementScores.push(score);
          });

          distributionIdxs.forEach(idx => {
            if (row[idx] == null) return;
            const val = String(row[idx]).trim();
            if (!val || val === "." || val.toLowerCase() === "none") return;
            const bucket = answerDistributions[headers[idx]];
            bucket[val] = (bucket[val] || 0) + 1;
          });

          if (idxLiked !== -1 && row[idxLiked]) {
            const val = String(row[idxLiked]).trim();
            if (val && val !== "." && val.toLowerCase() !== "none") {
              likes.push(val);
            }
          }

          if (idxImprove !== -1 && row[idxImprove]) {
            const val = String(row[idxImprove]).trim();
            if (val && val !== "." && val.toLowerCase() !== "none") {
              improvements.push(val);
            }
          }
        }

        const avgScore = calculateCleanAverage(scores);
        const contentScore = contentScores.length > 0 ? calculateCleanAverage(contentScores) : avgScore;
        const managementScore = managementScores.length > 0 ? calculateCleanAverage(managementScores) : avgScore;
        const engagementScore = engagementScores.length > 0 ? calculateCleanAverage(engagementScores) : avgScore;
        const weightedUtilization = calculateWeightedUtilization(contentScore, managementScore, engagementScore);

        const metrics: SatisfactionMetrics = {
          respondents: scores.length || rows.length - 1,
          average_score: avgScore,
          answer_distributions: answerDistributions,
          feedback_likes: likes.slice(0, 5),
          feedback_improvements: improvements.slice(0, 5),
          content_score: contentScore,
          management_support_score: managementScore,
          engagement_score: engagementScore,
          weighted_utilization_score: weightedUtilization,
          responses,
        };

        resolve(metrics);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};
