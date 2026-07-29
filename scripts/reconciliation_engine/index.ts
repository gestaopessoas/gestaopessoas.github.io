import * as path from "path";
import * as xlsx from "xlsx";
import { parseRgsExcel } from "./parsers/rgsExcel";
import { parseDominioPdf } from "./parsers/dominioPdf";
import { parseSolidesJson } from "./parsers/solidesJson";
import { parseCustosExcel } from "./parsers/custosExcel";
import { Merger, MasterRecord } from "./merger";
import * as fs from "fs";

async function run() {
  const baseDir = "C:\\Users\\ACPO Empreendimentos\\Desktop\\Importar dados";
  
  console.log("=== INICIANDO MOTOR DE CONCILIAÇÃO BATCH ===");
  
  // 1. Load RGS (Source of Truth)
  const rgsPath = path.join(baseDir, "Controle RGS - 27-07-2026.xlsx");
  console.log(`[1/4] Carregando Fonte da Verdade: ${rgsPath}`);
  const rgsData = parseRgsExcel(rgsPath);
  console.log(`      -> ${rgsData.length} registros carregados do RGS.`);
  
  const merger = new Merger(rgsData);

  // 2. Load Solides JSON
  const solidesPath = path.join(baseDir, "colaboradores_detalhes.json");
  console.log(`[2/4] Carregando Sólides: ${solidesPath}`);
  const solidesData = parseSolidesJson(solidesPath);
  console.log(`      -> ${solidesData.length} registros carregados do Sólides.`);
  merger.mergeSolides(solidesData);

  // 3. Load Custos Geral
  const custosPath = path.join(baseDir, "Custos Geral 20072026.xlsx");
  console.log(`[3/5] Carregando Custos Financeiros: ${custosPath}`);
  const custosData = parseCustosExcel(custosPath);
  console.log(`      -> ${custosData.length} registros carregados de Custos.`);
  merger.mergeCustos(custosData);

  // 4. Load Dominio PDFs from Subfolders
  console.log(`[4/5] Carregando Relatórios Domínio...`);
  const folders = [
    "SPE MOOV RESIDENCIAL- 58", 
    "ACPO LIFE RG - 71",
    "CONSTRUTORA ACPO MTZ - 1",
    "DIRECT - 62",
    "LOT ACPO CIDADE ALTA - 11",
    "SPE CONNECT DUQUE - 39"
  ];
  
  for (const folder of folders) {
    const folderPath = path.join(baseDir, folder);
    if (!fs.existsSync(folderPath)) continue;
    
    // Ler Empregados.pdf ou Geral.pdf
    let pdfPath = path.join(folderPath, "Empregados.pdf");
    if (!fs.existsSync(pdfPath)) {
      pdfPath = path.join(folderPath, "Geral.pdf");
    }

    if (fs.existsSync(pdfPath)) {
      console.log(`      -> Lendo PDF: ${pdfPath}`);
      const dominioData = await parseDominioPdf(pdfPath);
      console.log(`         Encontrados ${dominioData.length} empregados no Domínio (${folder}).`);
      merger.mergeDominio(dominioData, folder);
    }
  }

  // 5. Consolidation & Output
  console.log(`[5/5] Consolidando e Exportando...`);
  const records = merger.getMasterRecords();
  
  // Transform to Excel friendly format
  const rows = records.map(r => ({
    Status: r.status,
    CPF: r.cpf,
    Nome: r.name,
    Matricula: r.registrationNumber || "",
    Vinculo: r.contractType || "",
    Centro_Custo: r.costCenter || "",
    Empresa_Dominio: r.sourceCompany || "",
    Cargo: r.role || "",
    Plano_Carreira: r.careerPlan || "",
    Salario_Base: r.baseSalary || 0,
    Beneficios: r.benefits || "",
    Email: r.email || "",
    Telefone: r.phone || "",
    Admissao: r.admissionDate || "",
    Mensagens_Alerta: r.messages.join(" | ")
  }));

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(rows);
  
  // Ajuste de largura das colunas básico
  ws["!cols"] = [
    { wch: 10 }, { wch: 15 }, { wch: 35 }, { wch: 12 }, 
    { wch: 12 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, 
    { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 30 },
    { wch: 15 }, { wch: 12 }, { wch: 100 }
  ];

  xlsx.utils.book_append_sheet(wb, ws, "Consolidado");

  const outPath = path.join(baseDir, "Master_Conciliado.xlsx");
  xlsx.writeFile(wb, outPath);

  const errors = records.filter(r => r.status === "WARNING" || r.status === "ERROR");

  console.log("=== CONCILIAÇÃO CONCLUÍDA ===");
  console.log(`Total de Colaboradores Unificados: ${records.length}`);
  console.log(`Total de Alertas/Divergências: ${errors.length}`);
  console.log(`\nPlanilha Exportada com Sucesso em:\n${outPath}`);
  console.log(`\n** DICA: Abra a planilha e filtre a coluna 'Status' por 'WARNING' para ver quem você precisa arrumar no RGS ou auditar! **`);
}

run().catch(console.error);
