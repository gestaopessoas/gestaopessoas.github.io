const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://bnwwdseczwrmmuvallml.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJud3dkc2VjendybW11dmFsbG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDIxMDcsImV4cCI6MjA5OTAxODEwN30.46hTU6b8xgpsoASZu0K7cEi_FfA3ZBt8e417mfrda7k';
const supabase = createClient(supabaseUrl, supabaseKey);

function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
  }
  return null;
}

async function run() {
  const csv = fs.readFileSync('/Users/brunosouza/Downloads/Controle RGS(2026).csv', 'utf8');
  const lines = csv.split('\n').filter(l => l.trim().length > 0);
  
  // Skip header
  lines.shift();
  
  const records = [];
  
  for (const line of lines) {
    const cols = line.split(';');
    if (cols.length < 3) continue;
    
    // Processo;Data do processo;Nome ;Cargo Atual ou Futuro;Contrato;Local;Setor;Vigência;Exame (data);SST;Descrição
    const process_type = cols[0]?.trim();
    if (!process_type) continue; // Skip empty rows

    const record = {
      process_type,
      process_date: parseDate(cols[1]),
      employee_name: cols[2]?.trim(),
      role: cols[3]?.trim(),
      contract_type: cols[4]?.trim(),
      location: cols[5]?.trim(),
      sector: cols[6]?.trim(),
      effective_date: parseDate(cols[7]),
      exam_date: parseDate(cols[8]),
      sst_status: cols[9]?.trim(),
      description: cols[10]?.trim(),
      status: 'Pendente'
    };
    
    // Check if it's a valid row
    if (record.employee_name && record.employee_name !== '') {
      records.push(record);
    }
  }
  
  console.log(`Encontrados ${records.length} processos válidos no CSV.`);
  
  // Insert in batches of 50
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

run();
