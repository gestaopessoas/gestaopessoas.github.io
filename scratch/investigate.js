const fs = require('fs');

const pdfText = fs.readFileSync('scratch/perfil_pdf.txt', 'utf8');

// Match "Nome do Cargo" ... "CÓDIGO DO PERFIL: C-XXXX"
// Actually let's look at the "Sumário" section
const sumarioMatch = pdfText.match(/Sumário\s+([\s\S]+?)(?=\n\d+\s*\n|$)/);
if (sumarioMatch) {
    const lines = sumarioMatch[1].split('\n').filter(l => l.includes('.'));
    console.log("--- Roles from PDF Sumário ---");
    console.log(lines.slice(0, 10).map(l => l.trim()).join('\n'));
}

console.log("--- PDF Snippets for C-XXXX ---");
const matches = [...pdfText.matchAll(/(.{0,80})(C-\d{4})(.{0,80})/g)];
for (let i = 0; i < Math.min(10, matches.length); i++) {
    console.log(`Match ${i+1}:`, matches[i][0].replace(/\n/g, ' '));
}

const excelData = JSON.parse(fs.readFileSync('scratch/tabela_salarial.json', 'utf8'));
for (const sheet of ['Administrativo', 'Engenharia', 'Operacional']) {
    console.log(`\n--- Sheet ${sheet} Roles ---`);
    let count = 0;
    for (const row of excelData[sheet]) {
        // usually the role is in __EMPTY or __EMPTY_1 or the first key that is not null
        const val = row['__EMPTY'] || row['Cargo'] || Object.values(row)[0];
        if (typeof val === 'string' && val.length > 3 && val !== 'CLT' && val !== 'PJ' && !val.includes('Nível')) {
            console.log(val);
            count++;
            if (count >= 5) break;
        }
    }
}
