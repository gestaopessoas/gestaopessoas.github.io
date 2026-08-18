import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type LunchAttendee = {
  name: string;
  department?: string;
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

export const exportLunchListPdf = async (dateLabel: string, attendees: LunchAttendee[]) => {
  const doc = new jsPDF("portrait");

  const GOLD: [number, number, number] = [222, 170, 48];
  const TITLE_TEXT: [number, number, number] = [43, 47, 51];
  const LABEL_TEXT: [number, number, number] = [75, 80, 87];

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
  doc.text("ATA DE ALMOÇO — SEDE", 196, 16, { align: "right" });

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
  doc.text(`CONFIRMAÇÃO DE ALMOÇO — ${dateLabel}`, 105, 38, { align: "center" });

  const tableData = attendees.map((a, index) => [
    String(index + 1),
    a.name,
    a.department || "-",
    "",
  ]);

  autoTable(doc, {
    startY: 45,
    head: [["Nº", "Colaborador", "Setor", "Assinatura"]],
    body: tableData,
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 10,
      textColor: TITLE_TEXT,
      lineColor: [201, 204, 206],
      lineWidth: 0.1,
      minCellHeight: 10,
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
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 65 },
      2: { cellWidth: 45 },
      3: { cellWidth: 60 },
    },
    didDrawPage: function (data) {
      const str = "Página " + doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(LABEL_TEXT[0], LABEL_TEXT[1], LABEL_TEXT[2]);
      doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 10);

      doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
      doc.text("ACPO-RH", 196, doc.internal.pageSize.height - 10, { align: "right" });
    },
  });

  doc.save(`ata_almoco_${dateLabel.replace(/\//g, "-")}.pdf`);
};
