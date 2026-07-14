require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const dir = 'C:\\Users\\ACPO Empreendimentos\\Downloads\\Empregados Solides';

async function importData() {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  
  const uniqueDepts = new Set();
  const uniqueRoles = new Set();
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    const deptMatch = content.match(/- \*\*Departamento:\*\* (.*)/);
    const roleMatch = content.match(/- \*\*Cargo:\*\* (.*)/);
    
    if (deptMatch && deptMatch[1].trim() !== 'Não preenchido') uniqueDepts.add(deptMatch[1].trim());
    if (roleMatch && roleMatch[1].trim() !== 'Não preenchido') uniqueRoles.add(roleMatch[1].trim());
  }
  
  console.log(`Found ${uniqueDepts.size} departments and ${uniqueRoles.size} roles.`);
  
  let sql = `-- Departments\n`;
  for (const dept of uniqueDepts) {
    sql += `INSERT INTO public.departments (name) VALUES ('${dept.replace(/'/g, "''")}') ON CONFLICT DO NOTHING;\n`;
  }
  
  sql += `\n-- Roles\n`;
  for (const role of uniqueRoles) {
    let title = role;
    let code = '';
    const codeMatch = role.match(/\((C-\d+)\)/);
    if (codeMatch) {
      code = codeMatch[1];
      title = role.replace(/\(C-\d+\)/, '').trim();
    }
    const safeTitle = title.replace(/'/g, "''");
    const safeCode = (code || title.substring(0, 3).toUpperCase()).replace(/'/g, "''");
    sql += `INSERT INTO public.job_profiles (title, profile_code) VALUES ('${safeTitle}', '${safeCode}') ON CONFLICT DO NOTHING;\n`;
  }
  
  fs.writeFileSync('insert_data.sql', sql);
  console.log("SQL script generated as insert_data.sql");
}

importData();
