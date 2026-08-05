import * as XLSX from "xlsx";
import { calculateCleanAverage, calculateWeightedUtilization } from "@/utils/trainingMath.mjs";

export type SatisfactionMetrics = {
  respondents: number;
  average_score: number;
  expectations: Record<string, number>;
  feedback_likes: string[];
  feedback_improvements: string[];
  content_score?: number;
  management_support_score?: number;
  engagement_score?: number;
  weighted_utilization_score?: number;
};

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
        let idxExpectations = -1;
        let idxContent = -1;
        let idxManagement = -1;
        let idxEngagement = -1;
        
        headers.forEach((h, i) => {
          const lower = h.toLowerCase();
          if (lower.includes("de 0 a 10") || lower.includes("nota geral")) idxScore = i;
          if (lower.includes("mais gostou")) idxLiked = i;
          if (lower.includes("pode ser melhorado")) idxImprove = i;
          if (lower.includes("expectativas")) idxExpectations = i;
          if (lower.includes("conteúdo") || lower.includes("aplicabilidade")) idxContent = i;
          if (lower.includes("gestão") || lower.includes("suporte")) idxManagement = i;
          if (lower.includes("engajamento") || lower.includes("feedback")) idxEngagement = i;
        });

        const scores: (string | number)[] = [];
        const contentScores: (string | number)[] = [];
        const managementScores: (string | number)[] = [];
        const engagementScores: (string | number)[] = [];
        const likes: string[] = [];
        const improvements: string[] = [];
        const expectations: Record<string, number> = {};

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as unknown[];
          if (!row || row.length === 0) continue;

          if (idxScore !== -1 && row[idxScore] != null) scores.push(row[idxScore] as string | number);
          if (idxContent !== -1 && row[idxContent] != null) contentScores.push(row[idxContent] as string | number);
          if (idxManagement !== -1 && row[idxManagement] != null) managementScores.push(row[idxManagement] as string | number);
          if (idxEngagement !== -1 && row[idxEngagement] != null) engagementScores.push(row[idxEngagement] as string | number);

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

          if (idxExpectations !== -1 && row[idxExpectations]) {
            const val = String(row[idxExpectations]).trim();
            if (val && val.toLowerCase() !== "none") {
              expectations[val] = (expectations[val] || 0) + 1;
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
          expectations,
          feedback_likes: likes.slice(0, 5),
          feedback_improvements: improvements.slice(0, 5),
          content_score: contentScore,
          management_support_score: managementScore,
          engagement_score: engagementScore,
          weighted_utilization_score: weightedUtilization,
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
