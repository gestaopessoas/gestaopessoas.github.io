const fs = require('fs');
const excelData = JSON.parse(fs.readFileSync('scratch/tabela_salarial.json', 'utf8'));

console.log("=== CONFIGURAÇÃO ===");
console.log(JSON.stringify(excelData['Conferência'], null, 2));

console.log("\n=== ROW HEADERS FROM ADMINISTRATIVO ===");
console.log(JSON.stringify(excelData['Administrativo'].slice(0, 4), null, 2));

console.log("\n=== SAMPLE ROLE FROM ADMINISTRATIVO ===");
// Find the first actual role
for (const row of excelData['Administrativo']) {
    const val = row['__EMPTY'] || row['Cargo'] || Object.values(row)[0];
    if (typeof val === 'string' && val.length > 3 && val !== 'CLT' && val !== 'PJ' && !val.includes('Nível')) {
        console.log(JSON.stringify(row, null, 2));
        break;
    }
}
