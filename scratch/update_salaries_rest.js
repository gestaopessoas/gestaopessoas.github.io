const fs = require('fs');

async function main() {
  const data = JSON.parse(fs.readFileSync('C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/cdabee16-7d60-4be9-9d46-c848215f92a7/scratch/excel_data.json', 'utf8'));
  
  const supabaseUrl = 'https://bnwwdseczwrmmuvallml.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJud3dkc2VjendybW11dmFsbG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDIxMDcsImV4cCI6MjA5OTAxODEwN30.46hTU6b8xgpsoASZu0K7cEi_FfA3ZBt8e417mfrda7k';

  let count = 0;
  for (const row of data) {
    const reg = row['Cod'];
    if (!reg) continue;
    
    const base = row['BASE'] || 0;
    const comVg = row['Com/VG'] || 0;
    
    const updateRes = await fetch(`${supabaseUrl}/rest/v1/employees?registration_number=eq.${reg}`, {
        method: "PATCH",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ base_salary: base, commission: comVg })
    });
    
    if (updateRes.ok) count++;
  }
  console.log(`Updated ${count} salaries.`);
}

main().catch(console.error);
