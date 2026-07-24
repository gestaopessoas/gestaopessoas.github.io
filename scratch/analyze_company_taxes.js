const fs = require('fs');

const data = JSON.parse(fs.readFileSync('C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/cdabee16-7d60-4be9-9d46-c848215f92a7/scratch/excel_data.json', 'utf8'));

const companies = {};

data.forEach(row => {
  const encargoStr = row['ENCARGO '];
  if (!encargoStr) return;
  const company = row['EMPRESA / OBRA '] || row['Empresa/Obra'];
  const costCenter = row['Centro de custo'];
  
  if (!companies[company]) companies[company] = {};
  if (!companies[company][costCenter]) companies[company][costCenter] = new Set();
  
  companies[company][costCenter].add(encargoStr);
});

for (const comp in companies) {
  for (const cc in companies[comp]) {
    companies[comp][cc] = Array.from(companies[comp][cc]);
  }
}

console.log(JSON.stringify(companies, null, 2));
