import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const generateTrainingReport = (monthLabel: string, sessions: any[]) => {
  const doc = new jsPDF("landscape");
  
  // Header
  doc.setFontSize(18);
  doc.text(`Relatório de Treinamentos - ${monthLabel}`, 14, 20);
  
  // Summary Data
  const totalParticipants = sessions.reduce((acc, s) => acc + (s.participant_count || 0), 0);
  const totalHours = sessions.reduce((acc, s) => {
    if (!s.training_time) return acc;
    const [h, m] = s.training_time.split(":");
    return acc + Number(h) + (Number(m) / 60);
  }, 0);
  
  const indicator = totalParticipants > 0 ? (totalHours / (totalParticipants * 193.6)).toFixed(4) : "0.0000";
  
  doc.setFontSize(12);
  doc.text(`Total de Participações: ${totalParticipants}`, 14, 30);
  doc.text(`Total de Horas: ${totalHours.toFixed(1)}h`, 14, 38);
  doc.text(`Indicador de Treinamento (Horas / (Part * 193.6)): ${indicator}`, 14, 46);
  
  // Table Data
  const tableData = sessions.map((s) => {
    const score = s.satisfaction_metrics?.average_score 
      ? s.satisfaction_metrics.average_score.toFixed(1) + "/10" 
      : "N/A";
    const resp = s.satisfaction_metrics?.respondents || 0;
    
    return [
      s.theme,
      new Date(s.training_date + "T12:00:00").toLocaleDateString("pt-BR"),
      s.training_time?.slice(0, 5) || "-",
      s.participant_count || 0,
      score,
      resp > 0 ? `${resp} av.` : "-"
    ];
  });
  
  autoTable(doc, {
    startY: 55,
    head: [["Tema", "Data", "Duração", "Participantes", "Nota (0-10)", "Avaliações"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [41, 128, 185] }
  });
  
  // Additional Feedback Section
  let finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.text("Destaques das Avaliações Qualitativas", 14, finalY);
  finalY += 10;
  
  doc.setFontSize(10);
  sessions.forEach((s) => {
    if (s.satisfaction_metrics && (s.satisfaction_metrics.feedback_likes.length > 0 || s.satisfaction_metrics.feedback_improvements.length > 0)) {
      if (finalY > 180) {
        doc.addPage();
        finalY = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.text(`- ${s.theme}`, 14, finalY);
      finalY += 6;
      doc.setFont("helvetica", "normal");
      
      if (s.satisfaction_metrics.feedback_likes.length > 0) {
        doc.text(`Elogios: ${s.satisfaction_metrics.feedback_likes[0]}`, 18, finalY);
        finalY += 6;
      }
      if (s.satisfaction_metrics.feedback_improvements.length > 0) {
        doc.text(`Sugestões: ${s.satisfaction_metrics.feedback_improvements[0]}`, 18, finalY);
        finalY += 8;
      }
    }
  });

  doc.save(`treinamentos-${monthLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`);
};
