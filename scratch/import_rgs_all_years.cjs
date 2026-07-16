const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bnwwdseczwrmmuvallml.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJud3dkc2VjendybW11dmFsbG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDIxMDcsImV4cCI6MjA5OTAxODEwN30.46hTU6b8xgpsoASZu0K7cEi_FfA3ZBt8e417mfrda7k';
const supabase = createClient(supabaseUrl, supabaseKey);

function parseExcelDate(excelSerialDate) {
  if (!excelSerialDate) return null;
  if (typeof excelSerialDate === 'string') {
    let cleanStr = excelSerialDate.trim();
    if (cleanStr.includes('.-')) cleanStr = cleanStr.replace('.-', '-');
    
    const parts = cleanStr.split('/');
    if (parts.length === 3) {
      let d = parts[0].padStart(2, '0');
      let m = parts[1].padStart(2, '0');
      let y = parts[2];
      if (y.length === 6) y = y.slice(2); // "012026" -> "2026"
      if (y.length === 4) return `${y}-${m}-${d}`;
    }
    
    if (cleanStr.match(/^\d{4}-\d{2}-\d{2}$/)) return cleanStr;
    return null; // fallback for "Concluído", "Fevereiro", etc.
  }
  const date = new Date(Math.round((excelSerialDate - 25569) * 86400 * 1000));
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

async function run() {
  const filePath = 'G:/Meu Drive/ACPO/14/Controle RGS.xlsx';
  const wb = xlsx.readFile(filePath);
  
  // Fetch existing records to avoid duplicates
  console.log("Buscando registros existentes no banco...");
  let existingRecords = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase.from('rgs_processes').select('employee_name, role, process_date').range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) {
      console.error(error);
      return;
    }
    if (data.length === 0) break;
    existingRecords = existingRecords.concat(data);
    page++;
  }
  
  const existingSet = new Set(
    existingRecords.map(r => `${r.employee_name}|${r.role}|${r.process_date}`)
  );
  
  let newRecordsToInsert = [];
  
  for (const sheetName of wb.SheetNames) {
    if (!sheetName.match(/^\d{4}$/)) continue; // Only process '2023', '2024', etc.
    
    console.log(`Processando aba ${sheetName}...`);
    const sheet = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    const dataRows = rows.slice(1); // skip header
    
    for (const cols of dataRows) {
      if (cols.length < 3) continue;
      const process_type = cols[0];
      if (!process_type || process_type.toString().trim() === '') continue;

      const process_date = parseExcelDate(cols[1]);
      const employee_name = cols[2]?.toString().trim() || null;
      const role = cols[3]?.toString().trim() || null;
      const contract_type = cols[4]?.toString().trim() || null;
      const location = cols[5]?.toString().trim() || null;
      const sector = cols[6]?.toString().trim() || null;
      const effective_date = parseExcelDate(cols[7]);
      const documentation = cols[8]?.toString().trim() || null;
      const exam_date = parseExcelDate(cols[9]);
      const integration = cols[10]?.toString().trim() || null;
      const domain_access = cols[11]?.toString().trim() || null;
      const solides = cols[12]?.toString().trim() || null;
      const accesses = cols[13]?.toString().trim() || null;
      const esocial_aso = cols[14]?.toString().trim() || null;
      const esocial_amb = cols[15]?.toString().trim() || null;
      
      const key = `${employee_name}|${role}|${process_date}`;
      if (!employee_name || existingSet.has(key)) {
        continue; // Already exists or no name
      }
      
      existingSet.add(key); // prevent duplicates within the spreadsheet itself
      
      newRecordsToInsert.push({
        process_type: process_type?.toString().trim() || null,
        process_date,
        employee_name,
        role,
        contract_type,
        location,
        sector,
        effective_date,
        documentation,
        exam_date,
        integration,
        domain_access,
        solides,
        accesses,
        esocial_aso,
        esocial_amb,
        status: 'Pendente'
      });
    }
  }
  
  console.log(`Encontrados ${newRecordsToInsert.length} NOVOS processos nas planilhas.`);
  
  for (let i = 0; i < newRecordsToInsert.length; i += 50) {
    const batch = newRecordsToInsert.slice(i, i + 50);
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
