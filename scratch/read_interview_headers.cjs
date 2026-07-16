const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");

const filePath = "G:\\Meu Drive\\ACPO\\14\\Entrevistas realizadas\\1. Janeiro.xlsx";

try {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const headers = [];
  const range = xlsx.utils.decode_range(worksheet['!ref']);
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = worksheet[xlsx.utils.encode_cell({c: C, r: range.s.r})];
    let hdr = "UNKNOWN " + C;
    if (cell && cell.t) hdr = xlsx.utils.format_cell(cell);
    headers.push(hdr);
  }
  
  console.log("Headers for 1. Janeiro.xlsx:");
  console.log(headers);

  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 }).slice(1, 4);
  console.log("First 3 rows of data:");
  console.log(data);

} catch (error) {
  console.error("Error reading file:", error);
}
