const XLSX = require('xlsx');

try {
  const wb = XLSX.readFile('C:/Users/ACPO Empreendimentos/Desktop/Book.xlsx');
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log(JSON.stringify(rows, null, 2));
} catch (err) {
  console.error(err.message);
}
