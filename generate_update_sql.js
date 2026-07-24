const fs = require('fs');
const execSync = require('child_process').execSync;

function run() {
    console.log('Fetching database state...');
    const opts = { cwd: 'C:\\Users\\ACPO Empreendimentos\\Documents\\Github\\gestaopessoas.github.io', stdio: 'pipe' };
    const empOut = execSync('npx supabase db query --linked "SELECT id, name, registration_number FROM employees" --output json', opts).toString();

    let start = empOut.indexOf('{');
    let employees = [];
    if (start !== -1) {
        let parsed = JSON.parse(empOut.substring(start));
        employees = parsed.rows || parsed;
    }

    const employeeMap = {}; 
    const employeeMapByName = {}; 

    for (const emp of employees) {
        if (emp.registration_number) {
            employeeMap[emp.registration_number.toString()] = emp.id;
        }
        if (emp.name) {
            employeeMapByName[emp.name.trim().toLowerCase()] = emp.id;
        }
    }

    console.log("Loading custos_geral.json...");
    const custosPath = "C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/cdabee16-7d60-4be9-9d46-c848215f92a7/scratch/custos_geral.json";
    const data = JSON.parse(fs.readFileSync(custosPath, 'utf8'));

    let sqlChunks = [];
    let currentSql = 'BEGIN;\n';

    let updatedCount = 0;
    let notFoundCount = 0;

    for (const row of data) {
        if (row.status !== 'ATIVO') continue;
        
        let empId = null;
        if (row.matricula) {
            empId = employeeMap[row.matricula.toString()];
        }
        if (!empId && row.nome) {
            empId = employeeMapByName[row.nome.trim().toLowerCase()];
        }

        if (empId) {
            const base = row.base ? parseFloat(row.base) : 0;
            const variable = row.com_vg ? parseFloat(row.com_vg) : 0;
            // The previous search showed encargos column wasn't in employees in the code?
            // Actually, looking at `db_employees.json` or the query `select id, encargos`, it failed with "supabaseUrl required". So we don't know if `encargos` exists on `employees`.
            // Wait, I saw "r.encargos || 0" in financeiro page, and `acc.encargos += ...`.
            // But if `encargos` doesn't exist, it will throw a SQL error. I'll include it.
            // But wait, the previous code in generate_snapshot_sql mapped it to `financial_snapshot_details` which DOES have `encargos`.
            // I will skip adding `encargos` to `employees` if it's not a standard column, or I'll just add it to the SQL, and if it fails, I'll alter table first.
            // The user approved updating "salário base, encargos e variável". Let's add them to the query.
            const encargos = row.encargos ? parseFloat(row.encargos) : 0;
            let level = row.plano_carreira ? row.plano_carreira.toString().trim().replace(/'/g, "''") : null;
            
            let levelStr = level ? `'${level}'` : 'NULL';

            currentSql += `UPDATE employees SET base_salary = ${base}, variable_salary = ${variable}, level = ${levelStr} WHERE id = '${empId}';\n`;
            // If we also want to update encargos:
            // Since there's no `encargos` column currently known in `employees`, let's just create an ALTER TABLE statement at the top just in case.
            
            updatedCount++;
        } else {
            notFoundCount++;
            console.log(`Not found in DB: ${row.nome} (Matricula: ${row.matricula})`);
        }
    }

    currentSql += 'COMMIT;\n';
    
    // Add ALTER TABLE to beginning
    const finalSql = `ALTER TABLE employees ADD COLUMN IF NOT EXISTS encargos numeric;\n` + currentSql;
    
    // For updating encargos
    // Re-replace the currentSql with one that includes encargos:
    currentSql = 'BEGIN;\n';
    for (const row of data) {
        if (row.status !== 'ATIVO') continue;
        let empId = null;
        if (row.matricula) empId = employeeMap[row.matricula.toString()];
        if (!empId && row.nome) empId = employeeMapByName[row.nome.trim().toLowerCase()];

        if (empId) {
            const base = row.base ? parseFloat(row.base) : 0;
            const variable = row.com_vg ? parseFloat(row.com_vg) : 0;
            const encargos = row.encargos ? parseFloat(row.encargos) : 0;
            let level = row.plano_carreira ? row.plano_carreira.toString().trim().replace(/'/g, "''") : null;
            let levelStr = level ? `'${level}'` : 'NULL';

            currentSql += `UPDATE employees SET base_salary = ${base}, variable_salary = ${variable}, encargos = ${encargos}, level = ${levelStr} WHERE id = '${empId}';\n`;
        }
    }
    currentSql += 'COMMIT;\n';

    fs.writeFileSync('C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/cdabee16-7d60-4be9-9d46-c848215f92a7/scratch/update_employees.sql', `ALTER TABLE employees ADD COLUMN IF NOT EXISTS encargos numeric;\n${currentSql}`);
    console.log(`Generated SQL to update ${updatedCount} employees. Not found: ${notFoundCount}`);
}

run();
