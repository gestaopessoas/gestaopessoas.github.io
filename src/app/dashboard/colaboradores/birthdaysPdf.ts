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
const TITLE_TEXT: [number, number, number] = [43, 47, 51];
const LABEL_TEXT: [number, number, number] = [75, 80, 87];

// Mesmo papel timbrado para as duas listas do mês (vida e tempo de casa): só muda o
// título, as colunas e o nome do arquivo.
const exportMonthListPdf = async ({ title, listTitle, head, body, columnStyles, fileName }: {
  title: string;
  listTitle: string;
  head: string[];
  body: string[][];
  columnStyles: Record<number, Partial<Styles>>;
  fileName: string;
}) => {
  const doc = new jsPDF("portrait");

  try {
    const logoBase64 = await getBase64ImageFromUrl("/logos/SEDE.png");
    doc.addImage(logoBase64, "PNG", 14, 10, 45, 12);
  } catch (err) {
    console.warn("Could not load logo for PDF:", err);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.text("//", 14, 20);
    doc.setTextColor(TITLE_TEXT[0], TITLE_TEXT[1], TITLE_TEXT[2]);
    doc.text("ACPO", 21, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("EMPREENDIMENTOS", 14, 24);
  }

  doc.setFont("helvetica", "bold");
  doc.setTextColor(TITLE_TEXT[0], TITLE_TEXT[1], TITLE_TEXT[2]);
  doc.setFontSize(16);
  doc.text(title, 196, 16, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(LABEL_TEXT[0], LABEL_TEXT[1], LABEL_TEXT[2]);
  doc.text("GESTÃO DE PESSOAS", 196, 21, { align: "right" });

  doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setLineWidth(0.5);
  doc.line(14, 26, 196, 26);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(TITLE_TEXT[0], TITLE_TEXT[1], TITLE_TEXT[2]);
  doc.setFontSize(14);
  doc.text(listTitle, 105, 38, { align: "center" });

  autoTable(doc, {
    startY: 45,
    head: [head],
    body,
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 10,
      textColor: TITLE_TEXT,
      lineColor: [201, 204, 206],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [244, 244, 244],
      textColor: TITLE_TEXT,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    margin: { left: 14, right: 14 },
    columnStyles,
    didDrawPage: function (data) {
      const str = "Página " + doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(LABEL_TEXT[0], LABEL_TEXT[1], LABEL_TEXT[2]);
      doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 10);

      doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
      doc.text("ACPO-RH", 196, doc.internal.pageSize.height - 10, { align: "right" });
    },
  });

  doc.save(fileName);
};

export const exportBirthdaysPdf = (monthName: string, birthdays: BirthdayData[]) =>
  exportMonthListPdf({
    title: `ANIVERSARIANTES DE ${monthName.toUpperCase()}`,
    listTitle: "LISTA DE ANIVERSARIANTES",
    head: ["Dia", "Colaborador", "Cargo", "Obra/Sede", "Idade"],
    body: birthdays.map((b) => [
      b.day.toString().padStart(2, "0"),
      b.name,
      b.role,
      b.workplace,
      b.age.toString(),
    ]),
    columnStyles: {
      0: { cellWidth: 13, halign: "center" }, // Dia
      1: { cellWidth: 62 }, // Colaborador
      2: { cellWidth: 52 }, // Cargo
      3: { cellWidth: 42 }, // Obra/Sede
      4: { cellWidth: 13, halign: "center" }, // Idade
    },
    fileName: `aniversariantes_${monthName}.pdf`,
  });

export const exportWorkAnniversariesPdf = (monthName: string, anniversaries: WorkAnniversaryData[]) =>
  exportMonthListPdf({
    title: `TEMPO DE CASA DE ${monthName.toUpperCase()}`,
    listTitle: "ANIVERSARIANTES DE TEMPO DE CASA",
    head: ["Dia", "Colaborador", "Cargo", "Obra/Sede", "Desde", "Anos"],
    body: anniversaries.map((a) => [
      a.day.toString().padStart(2, "0"),
      a.name,
      a.role,
      a.workplace,
      a.sinceDateStr,
      a.years.toString(),
    ]),
    columnStyles: {
      0: { cellWidth: 12, halign: "center" }, // Dia
      1: { cellWidth: 52 }, // Colaborador
      2: { cellWidth: 44 }, // Cargo
      3: { cellWidth: 38 }, // Obra/Sede
      4: { cellWidth: 22, halign: "center" }, // Desde
      5: { cellWidth: 14, halign: "center" }, // Anos
    },
    fileName: `tempo_de_casa_${monthName}.pdf`,
  });
