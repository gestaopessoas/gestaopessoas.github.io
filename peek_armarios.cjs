const XLSX = require('xlsx');

function main() {
  const filePath = 'C:\\Users\\ACPO Empreendimentos\\Downloads\\Chaves de Armários.xlsx';
  const workbook = XLSX.readFile(filePath);
  
  for (const sheetName of workbook.SheetNames) {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log('Total rows:', data.length);
    console.log('First 20 rows:');
    console.log(JSON.stringify(data.slice(0, 20), null, 2));
  }
}

main();
