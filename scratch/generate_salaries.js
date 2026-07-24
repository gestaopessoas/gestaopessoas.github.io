const fs = require('fs');

async function main() {
  const data = JSON.parse(fs.readFileSync('C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/cdabee16-7d60-4be9-9d46-c848215f92a7/scratch/excel_data.json', 'utf8'));
  
  const sqlStatements = [];
  
  data.forEach(row => {
    const reg = row['Cod'];
    if (!reg) return;
    
    const base = row['BASE'] || 0;
    const alimentacao = row['Alimentação'] || 0;
    const comVg = row['Com/VG'] || 0;
    const seguro = row['Seguro'] || 0;
    const odonto = row['Odonto'] || 0;
    const sulclinica = row['Sulclinica'] || 0;
    const vr = row['VR/Auxilios'] || 0;
    
    // We update the base salary, commission (which maps to Com/VG)
    sqlStatements.push(`UPDATE employees SET base_salary = ${base}, commission = ${comVg} WHERE registration_number = '${reg}';`);
    
    // And for benefits, we'll insert them into employee_benefits or a temporary table, but wait, the instructions said: 
    // "Os nomes dos benefícios serão mapeados diretamente dos benefícios que cadastramos no sistema."
    // Actually, the user wants us to calculate these. If I import the exact values from excel into the DB, the system will use the dynamic calculation?
    // Wait, the dynamic calculation needs to know the EXACT COST of "Odonto" per employee. 
    // In our system, Odonto might have a fixed cost for everyone, or we can just fetch it from employee_benefits.cost
  });

  fs.writeFileSync('C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/cdabee16-7d60-4be9-9d46-c848215f92a7/scratch/update_salaries.sql', sqlStatements.join('\n'));
}

main();
