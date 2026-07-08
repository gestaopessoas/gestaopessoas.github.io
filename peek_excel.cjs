const XLSX = require('xlsx');

function main() {
  const filePath = 'C:\\Users\\ACPO Empreendimentos\\Documents\\Caixa.xlsx';
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  console.log('Total rows:', data.length);
  console.log('First 15 rows:');
  console.log(JSON.stringify(data.slice(0, 15), null, 2));
}

main();
