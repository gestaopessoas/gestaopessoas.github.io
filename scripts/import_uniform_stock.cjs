const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf-8');
const supabase = createClient(
  env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim(),
  env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim()
);

const files = fs.readdirSync('C:/Users/ACPO Empreendimentos/Downloads');
const uniformFile = files.find(f => f.toUpperCase().includes('UNIFORME'));
const wb = XLSX.readFile('C:/Users/ACPO Empreendimentos/Downloads/' + uniformFile);

// Parse all data from sheets
const allRecords = [];

function parseSheet(sheetName, category) {
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  
  let headerRow = -1;
  let currentCategory = category;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Check if this row is a category label (only one non-empty cell that is a string, not TAMANHO)
    if (row.length === 1 && typeof row[0] === 'string' && row[0] !== 'TAMANHO') {
      currentCategory = row[0].trim();
      headerRow = -1;
      continue;
    }

    // Check if this is the header row
    if (row[0] === 'TAMANHO') {
      headerRow = i;
      continue;
    }

    // If we have a header row and this looks like data
    if (headerRow >= 0 && row[0] !== null && row[0] !== undefined && row[0] !== '') {
      const size = String(row[0]).trim();
      const available = row[1] || 0;
      const qty_taken = row[2] || 0;
      const stock = row[3] || 0;
      
      allRecords.push({
        category: currentCategory,
        size,
        available: Number(available),
        qty_taken: Number(qty_taken),
        stock: Number(stock)
      });
    }
  }
}

// POLO sheet - single category
parseSheet('POLO', 'POLO');
// BLUSÃO sheet - single category
parseSheet('BLUSÃO', 'BLUSÃO');
// FEMININO sheet - has sub-categories (CAMISA SOCIAL, JAQUETA)
parseSheet('FEMININO', 'FEMININO');
// MASCULINO sheet - has sub-categories (CAMISA SOCIAL, JAQUETA)
parseSheet('MASCULINO', 'MASCULINO');

// Fix categories for FEMININO / MASCULINO sheets
// The parseSheet already handles sub-categories by detecting header-less label rows.
// But for POLO and BLUSÃO the category label is in row 0 col 1, not col 0.
// Let's reparse POLO and BLUSÃO properly:
const allFixed = allRecords.map(r => {
  if (r.category === 'FEMININO') return { ...r, category: 'FEMININO - ' + r.category };
  if (r.category === 'MASCULINO') return { ...r, category: 'MASCULINO - ' + r.category };
  return r;
});

// Actually parseSheet handles sub-categories already. Let's just use allRecords directly
// but rename to avoid confusion
const finalRecords = [];

// Re-parse more carefully
['POLO', 'BLUSÃO'].forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  rows.forEach(row => {
    if (!row || row[0] === null || row[0] === undefined || row[0] === 'TAMANHO') return;
    if (typeof row[0] === 'string' && row[0].trim() === '') return;
    if (typeof row[1] === 'undefined') return;
    finalRecords.push({
      category: sheetName,
      size: String(row[0]).trim(),
      available: Number(row[1] || 0),
      qty_taken: Number(row[2] || 0),
      stock: Number(row[3] || 0)
    });
  });
});

['FEMININO', 'MASCULINO'].forEach(gender => {
  const ws = wb.Sheets[gender];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  let currentSubcat = gender;
  rows.forEach(row => {
    if (!row || row.length === 0) return;
    if (row[0] === 'TAMANHO') return;
    // Sub-category label
    if (row.length === 1 && typeof row[0] === 'string') {
      currentSubcat = gender + ' - ' + row[0].trim();
      return;
    }
    if (row[0] === null || row[0] === undefined || row[0] === '') return;
    if (typeof row[1] === 'undefined') return;
    finalRecords.push({
      category: currentSubcat,
      size: String(row[0]).trim(),
      available: Number(row[1] || 0),
      qty_taken: Number(row[2] || 0),
      stock: Number(row[3] || 0)
    });
  });
});

console.log('Records to insert:', finalRecords.length);
console.log(JSON.stringify(finalRecords, null, 2));

async function main() {
  // First clear existing stock data
  const { error: delErr } = await supabase.from('uniform_stock').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) {
    console.error('Could not delete. Table may not exist yet. Please run supabase-schema-v11-uniform-stock.sql first.');
    console.error(delErr.message);
    return;
  }

  const { data, error } = await supabase.from('uniform_stock').insert(finalRecords);
  if (error) {
    console.error('Insert error:', error.message);
  } else {
    console.log('✅ Inserted', finalRecords.length, 'records into uniform_stock!');
  }
}

main().catch(console.error);
