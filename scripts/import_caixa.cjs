const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://bnwwdseczwrmmuvallml.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJud3dkc2VjendybW11dmFsbG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDIxMDcsImV4cCI6MjA5OTAxODEwN30.46hTU6b8xgpsoASZu0K7cEi_FfA3ZBt8e417mfrda7k');

// Function to convert Excel serial date to YYYY-MM-DD
function excelDateToISODate(serial) {
  if (!serial || typeof serial !== 'number') return null;
  // Excel epoch is Jan 1, 1900. 25569 days is diff between 1900 and 1970
  // JS Date is in ms
  const jsDate = new Date((serial - 25569) * 86400 * 1000);
  // Get ISO without timezone drift
  const year = jsDate.getUTCFullYear();
  const month = String(jsDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jsDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function main() {
  console.log('Testando inserção de archive_box...');
  const { error: testErr } = await supabase.from('employees').insert([{ name: 'Test Box', status: 'Test', archive_box: 'Test' }]);
  if (testErr) {
    if (testErr.code === '42703') {
      console.error('ERRO: A coluna archive_box não existe no banco. O usuário não rodou o script SQL!');
      return;
    } else {
      console.error('Test error:', testErr);
      return;
    }
  }
  
  // Limpa o teste
  await supabase.from('employees').delete().eq('status', 'Test');

  console.log('Lendo planilha...');
  const filePath = 'C:\\Users\\ACPO Empreendimentos\\Documents\\Caixa.xlsx';
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  const employees = [];
  let currentBox = null;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    
    // Se a primeira coluna tem valor, é a definição da caixa (ex: "A01")
    if (row[0]) {
      currentBox = row[0].toString().trim();
    } else if (row[2]) {
      // Se não tem valor na primeira coluna, mas tem na terceira (Conteúdo), é o nome
      const name = row[2].toString().trim();
      const admissionDate = excelDateToISODate(row[3]);
      const dismissedDate = excelDateToISODate(row[4]);
      
      employees.push({
        name,
        archive_box: currentBox,
        admission_date: admissionDate,
        dismissed_at: dismissedDate,
        status: 'Arquivo Morto'
      });
    }
  }
  
  console.log(`Encontrados ${employees.length} registros para importar.`);
  
  // Inserção em lotes de 500
  const batchSize = 500;
  for (let i = 0; i < employees.length; i += batchSize) {
    const batch = employees.slice(i, i + batchSize);
    console.log(`Inserindo lote ${i/batchSize + 1}... (${batch.length} registros)`);
    const { error } = await supabase.from('employees').insert(batch);
    if (error) {
      console.error('Erro na inserção do lote:', error);
      break;
    }
  }
  
  console.log('Importação concluída com sucesso!');
}

main();
