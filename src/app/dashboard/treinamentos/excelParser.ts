import * as XLSX from "xlsx";

export type SatisfactionMetrics = {
  respondents: number;
  average_score: number;
  expectations: Record<string, number>;
  feedback_likes: string[];
  feedback_improvements: string[];
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
        
        // Converte para array de arrays (linhas e colunas)
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rows.length < 2) {
          throw new Error("O arquivo Excel está vazio ou não possui formato válido.");
        }

        const headers = rows[0].map(h => String(h || "").trim());
        
        let idxScore = -1;
        let idxLiked = -1;
        let idxImprove = -1;
        let idxExpectations = -1;
        
        headers.forEach((h, i) => {
          if (h.includes("De 0 a 10")) idxScore = i;
          if (h.includes("O que você mais gostou")) idxLiked = i;
          if (h.includes("O que pode ser melhorado")) idxImprove = i;
          if (h.includes("atendeu minhas expectativas")) idxExpectations = i;
        });

        const scores: number[] = [];
        const likes: string[] = [];
        const improvements: string[] = [];
        const expectations: Record<string, number> = {};

        // Ignora o cabeçalho (linha 0)
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          if (idxScore !== -1 && row[idxScore] != null) {
            const val = parseFloat(row[idxScore]);
            if (!isNaN(val)) scores.push(val);
          }

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

        const avgScore = scores.length > 0 
          ? scores.reduce((a, b) => a + b, 0) / scores.length 
          : 0;

        const metrics: SatisfactionMetrics = {
          respondents: scores.length,
          average_score: Number(avgScore.toFixed(1)),
          expectations,
          feedback_likes: likes.slice(0, 5), // pega as 5 primeiras
          feedback_improvements: improvements.slice(0, 5),
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
