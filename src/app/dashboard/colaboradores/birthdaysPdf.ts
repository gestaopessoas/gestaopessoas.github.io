import jsPDF from "jspdf";
import autoTable, { type Styles } from "jspdf-autotable";

export type BirthdayData = {
  name: string;
  role: string;
  workplace: string;
  day: number;
  age: number;
  birthDateStr: string;
};

export type WorkAnniversaryData = {
  name: string;
  role: string;
  workplace: string;
  day: number;
  years: number;
  sinceDateStr: string;
};

const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const GOLD: [number, number, number] = [222, 170, 48];
const GOLD_SOFT: [number, number, number] = [253, 246, 227];
const GOLD_DARK: [number, number, number] = [160, 118, 20];
const TITLE_TEXT: [number, number, number] = [43, 47, 51];
const LABEL_TEXT: [number, number, number] = [75, 80, 87];
const NO_WORKPLACE = "Sem obra/sede";

const anos = (n: number) => `${n} ${n === 1 ? "ano" : "anos"}`;

// Mesmo papel timbrado para as duas listas do mês (vida e tempo de casa), uma página por
// obra/sede para cada encarregado receber só a sua. Obra com lista longa continua na página
// seguinte com o mesmo cabeçalho. A última coluna é sempre a de destaque (idade / tempo).
const exportPerWorkplacePdf = async <T extends { workplace: string; day: number }>({
  monthName, title, subtitle, head, row, columnStyles, highlight, fileName, items,
}: {
  monthName: string;
  title: string;
  subtitle: (count: number, month: string) => string;
  head: string[];
  row: (item: T) => string[];
  columnStyles: Record<number, Partial<Styles>>;
  highlight: (item: T) => boolean;
  fileName: string;
  items: T[];
}) => {
  const doc = new jsPDF("portrait");
  const pageW = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;
  const lastCol = head.length - 1;

  let logo: string | null = null;
  try {
    logo = await getBase64ImageFromUrl("/logos/SEDE.png");
  } catch (err) {
    console.warn("Could not load logo for PDF:", err);
  }

  const groups = new Map<string, T[]>();
  for (const item of [...items].sort((x, y) => x.day - y.day)) {
    const key = item.workplace && item.workplace !== "-" ? item.workplace : NO_WORKPLACE;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const workplaces = [...groups.keys()].sort((x, y) =>
    x === NO_WORKPLACE ? 1 : y === NO_WORKPLACE ? -1 : x.localeCompare(y, "pt-BR"));

  const drawHeader = (workplace: string, count: number) => {
    if (logo) doc.addImage(logo, "PNG", 14, 10, 45, 12);
    else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(...TITLE_TEXT);
      doc.text("ACPO", 14, 19);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...TITLE_TEXT);
    doc.text(title, pageW - 14, 15, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...LABEL_TEXT);
    doc.text(`${monthName.toUpperCase()} · GESTÃO DE PESSOAS`, pageW - 14, 21, { align: "right" });

    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.6);
    doc.line(14, 26, pageW - 14, 26);

    // Faixa da obra: barra dourada + nome + quantos no mês
    doc.setFillColor(...GOLD);
    doc.rect(14, 33, 1.6, 13, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(...TITLE_TEXT);
    doc.text(workplace, 19.5, 39.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...LABEL_TEXT);
    doc.text(subtitle(count, monthName.toLowerCase()), 19.5, 45.5);
  };

  workplaces.forEach((workplace, i) => {
    const rows = groups.get(workplace)!;
    if (i > 0) doc.addPage();

    autoTable(doc, {
      startY: 54,
      margin: { top: 54, left: 14, right: 14, bottom: 18 },
      head: [head],
      body: rows.map(row),
      theme: "plain",
      styles: {
        font: "helvetica",
        fontSize: 10,
        textColor: TITLE_TEXT,
        cellPadding: { top: 3.2, bottom: 3.2, left: 3, right: 3 },
        lineColor: [226, 228, 230],
        lineWidth: { bottom: 0.2 },
        valign: "middle",
      },
      headStyles: {
        fillColor: TITLE_TEXT,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
        // borda da mesma cor do fundo, senão sobra fresta branca entre as células
        lineColor: TITLE_TEXT,
        lineWidth: 0.1,
      },
      columnStyles,
      // Data redonda (5/10/15 anos de casa, 30/40/50 de idade) ganha fundo dourado claro
      didParseCell: (data) => {
        if (data.section === "body" && highlight(rows[data.row.index])) {
          data.cell.styles.fillColor = GOLD_SOFT;
          if (data.column.index === lastCol) data.cell.styles.textColor = GOLD_DARK;
        }
      },
      didDrawPage: () => drawHeader(workplace, rows.length),
    });
  });

  // Rodapé no fim, quando o total de páginas já é conhecido
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 228, 230);
    doc.setLineWidth(0.2);
    doc.line(14, pageH - 14, pageW - 14, pageH - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...LABEL_TEXT);
    doc.text(`Página ${p} de ${total}`, 14, pageH - 9);
    doc.setTextColor(...GOLD);
    doc.text("ACPO-RH", pageW - 14, pageH - 9, { align: "right" });
  }

  doc.save(fileName);
};

export const exportBirthdaysPdf = (monthName: string, birthdays: BirthdayData[]) =>
  exportPerWorkplacePdf({
    monthName,
    title: "ANIVERSARIANTES",
    subtitle: (n, month) => `${n} ${n === 1 ? "aniversariante" : "aniversariantes"} em ${month}`,
    head: ["Dia", "Colaborador", "Cargo", "Nascimento", "Idade"],
    row: (b) => [b.day.toString().padStart(2, "0"), b.name, b.role, b.birthDateStr, anos(b.age)],
    columnStyles: {
      0: { cellWidth: 14, halign: "center", fontStyle: "bold", textColor: GOLD_DARK }, // Dia
      1: { cellWidth: 66, fontStyle: "bold" }, // Colaborador
      2: { cellWidth: 54, textColor: LABEL_TEXT }, // Cargo
      3: { cellWidth: 26, halign: "center", textColor: LABEL_TEXT }, // Nascimento
      4: { cellWidth: 22, halign: "center", fontStyle: "bold" }, // Idade
    },
    highlight: (b) => b.age % 10 === 0,
    fileName: `aniversariantes_${monthName}.pdf`,
    items: birthdays,
  });

export const exportWorkAnniversariesPdf = (monthName: string, anniversaries: WorkAnniversaryData[]) =>
  exportPerWorkplacePdf({
    monthName,
    title: "TEMPO DE CASA",
    subtitle: (n, month) =>
      `${n} ${n === 1 ? "colaborador completa" : "colaboradores completam"} tempo de casa em ${month}`,
    head: ["Dia", "Colaborador", "Cargo", "Desde", "Tempo"],
    row: (a) => [a.day.toString().padStart(2, "0"), a.name, a.role, a.sinceDateStr, anos(a.years)],
    columnStyles: {
      0: { cellWidth: 14, halign: "center", fontStyle: "bold", textColor: GOLD_DARK }, // Dia
      1: { cellWidth: 66, fontStyle: "bold" }, // Colaborador
      2: { cellWidth: 54, textColor: LABEL_TEXT }, // Cargo
      3: { cellWidth: 26, halign: "center", textColor: LABEL_TEXT }, // Desde
      4: { cellWidth: 22, halign: "center", fontStyle: "bold" }, // Tempo
    },
    highlight: (a) => a.years % 5 === 0,
    fileName: `tempo_de_casa_${monthName}.pdf`,
    items: anniversaries,
  });
