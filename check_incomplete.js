const fs = require('fs');
const execSync = require('child_process').execSync;

function run() {
    console.log('Fetching database state...');
    const opts = { cwd: 'C:\\Users\\ACPO Empreendimentos\\Documents\\Github\\gestaopessoas.github.io', stdio: 'pipe', maxBuffer: 1024 * 1024 * 50 };
    const out = execSync('npx supabase db query --linked "SELECT name, status, admission_date, registration_number, birthday, cost_center_id, company_id, workplace_id, dismissed_at FROM employees" --output json', opts).toString();

    let start = out.indexOf('{');
    let employees = [];
    if (start !== -1) {
        let parsed = JSON.parse(out.substring(start));
        employees = parsed.rows || parsed;
    }

    let activeList = [];
    let inactiveList = [];

    for (const emp of employees) {
        const isActive = emp.status === 'Ativo' || emp.status === 'Férias' || emp.status === 'Afastado';
        let missing = [];

        if (isActive) {
            if (!emp.admission_date) missing.push('Admissão');
            if (!emp.registration_number) missing.push('Matrícula');
            if (!emp.birthday) missing.push('Nascimento');
            if (!emp.cost_center_id) missing.push('Centro de Custo');
            if (!emp.company_id) missing.push('Empresa');
            if (!emp.workplace_id) missing.push('Obra/Local');
            
            if (missing.length > 0) {
                activeList.push({
                    name: emp.name,
                    status: emp.status,
                    missing: missing
                });
            }
        } else {
            // For inactive
            if (!emp.dismissed_at) missing.push('Data de Desligamento');
            
            if (missing.length > 0) {
                inactiveList.push({
                    name: emp.name,
                    status: emp.status,
                    missing: missing
                });
            }
        }
    }

    activeList.sort((a, b) => a.name.localeCompare(b.name));
    inactiveList.sort((a, b) => a.name.localeCompare(b.name));

    let md = `# Relatório de Cadastros Incompletos\n\n`;
    md += `Total de cadastros com pendências: **${activeList.length + inactiveList.length}**\n\n`;
    
    md += `## 🟢 Colaboradores Ativos/Afastados (${activeList.length})\n\n`;
    md += `| Colaborador | Status | O que falta |\n`;
    md += `|---|---|---|\n`;
    for (const item of activeList) {
        md += `| ${item.name} | ${item.status || 'Sem status'} | ${item.missing.join(', ')} |\n`;
    }
    
    md += `\n<br/>\n\n`;
    
    md += `## 🔴 Colaboradores Desligados/Inativos (${inactiveList.length})\n\n`;
    md += `| Colaborador | Status | O que falta |\n`;
    md += `|---|---|---|\n`;
    for (const item of inactiveList) {
        md += `| ${item.name} | ${item.status || 'Sem status'} | ${item.missing.join(', ')} |\n`;
    }

    fs.writeFileSync('C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/cdabee16-7d60-4be9-9d46-c848215f92a7/cadastros_incompletos.md', md, 'utf8');
    console.log("Done");
}

run();
