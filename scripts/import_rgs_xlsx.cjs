const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bnwwdseczwrmmuvallml.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJud3dkc2VjendybW11dmFsbG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDIxMDcsImV4cCI6MjA5OTAxODEwN30.46hTU6b8xgpsoASZu0K7cEi_FfA3ZBt8e417mfrda7k';
const supabase = createClient(supabaseUrl, supabaseKey);

function parseExcelDate(excelSerialDate) {
  if (!excelSerialDate) return null;
  if (typeof excelSerialDate === 'string') {
    // maybe it's a string like "15/07/2026"
    const parts = excelSerialDate.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return excelSerialDate;
  }
  // Convert serial date to JS Date
  // Excel uses 1900-01-01 as day 1. 1900 is not a leap year in reality, but excel thinks it is, so we subtract 1.
  const date = new Date(Math.round((excelSerialDate - 25569) * 86400 * 1000));
  return date.toISOString().split('T')[0];
}

async function run() {
  const filePath = 'G:/Meu Drive/ACPO/14/Controle RGS.xlsx';
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]]; // Processos/RGS sheet
  
  // Convert to JSON
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  // Skip the header
  const dataRows = rows.slice(1);
  
  const records = [];
  
  for (const cols of dataRows) {
    if (cols.length < 3) continue;
    
    // Processo;Data;Nome ;Cargo;Contrato;Local;Setor;Vigência;Documentação;Exame (data);Integração;Domínio;Sólides;Acessos;E-social ASO;E-social Amb.
    const process_type = cols[0];
    if (!process_type || process_type.trim() === '') continue; // Skip empty rows

    const process_date = parseExcelDate(cols[1]);
    const employee_name = cols[2];
    const role = cols[3];
    const contract_type = cols[4];
    const location = cols[5];
    const sector = cols[6];
    const effective_date = parseExcelDate(cols[7]);
    const documentation = cols[8];
    const exam_date = parseExcelDate(cols[9]);
    const integration = cols[10];
    const domain_access = cols[11];
    const solides = cols[12];
    const accesses = cols[13];
    const esocial_aso = cols[14];
    const esocial_amb = cols[15];
    
    const record = {
      process_type: process_type?.toString().trim() || null,
      process_date,
      employee_name: employee_name?.toString().trim() || null,
      role: role?.toString().trim() || null,
      contract_type: contract_type?.toString().trim() || null,
      location: location?.toString().trim() || null,
      sector: sector?.toString().trim() || null,
      effective_date,
      documentation: documentation?.toString().trim() || null,
      exam_date,
      integration: integration?.toString().trim() || null,
      domain_access: domain_access?.toString().trim() || null,
      solides: solides?.toString().trim() || null,
      accesses: accesses?.toString().trim() || null,
      esocial_aso: esocial_aso?.toString().trim() || null,
      esocial_amb: esocial_amb?.toString().trim() || null,
      status: 'Pendente' // user approved initial status
    };
    
    if (record.employee_name) {
      records.push(record);
    }
  }
  
  console.log(`Encontrados ${records.length} processos válidos na planilha.`);
  
  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50);
    const { error } = await supabase.from('rgs_processes').insert(batch);
    if (error) {
      console.error("Erro ao inserir lote:", error.message);
    } else {
      console.log(`Lote inserido com sucesso (${i + 1} a ${i + batch.length})`);
    }
  }
  console.log('Importação finalizada!');
}

run().catch(console.error);
