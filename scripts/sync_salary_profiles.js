const fs = require('fs');

// Read DB Roles to map to profile_code
const dbRoles = JSON.parse(fs.readFileSync('scratch/db_roles.json', 'utf8'));
function normalize(str) {
    if (!str) return '';
    return str.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9]/g, ''); 
}
const roleCodeMap = {};
for (const r of dbRoles) {
    roleCodeMap[normalize(r.title)] = r.profile_code;
}

// Map manual overrides for some Excel naming that might differ slightly from PDF
const manualMap = {
    "assistentecomercial": "c-0005",
    "assistentedecompras": "c-0110",
    "assistentedeorcamento": "auto-dd53b7",
    "assistentedeplanejamento": "c-0125",
    "administrativodeobras": "c-0094",
    "analistadesistemadegestaodaqualidade": "c-0115",
    "orçamentista": "c-0044",
    "projetista": "c-0047",
    "tecnicoemedificacoessetortecnico": "c-0050",
    "tecnicoemplanejamento": "c-0097",
    "coordenadorcomercialcargocomissionado": "c-0090",
    "coordenadorcontabil": "c-0174",
    "coordenadordegp": "c-0170",
    "coordenadortecnico": "c-0122",
    "coordenadordeprojetos": "c-0056",
    "coordenadordequalidade": "c-0021",
    "coordenadorderh": "c-0022",
    "coordenadorfinanceiro": "c-0066",
    "supervisoraadministrativoa": "c-0160",
    "supervisoradefinancas": "c-0161",
    "supervisoradeorcamentos": "c-0162", 
    "vicediretoraadministrativoefinanceiro": "c-0154",
    "vicedirectoradeestrategia": "c-0152",
    "vicediretoracomercial": "c-0153",
    "auxiliardemarketingtabelaengenharia": "c-0126",
    "assistentedemarketingtabelaengenharia": "c-0128",
    "analistademarketingtabelaengenharia": "c-0150",
    "tecnicoemedificacoessetorobras": "c-0051",
    "analistatecnicodequalidade": "c-0115",
    "coordenadordeobras": "c-0024",
    "tecnicoemsegurancadotrabalho": "c-0052",
    "coordenadordemanutencao": "c-0146",
    "psicologo": "c-0118",
    "psicologoorganizacional": "c-0118",
    "auxiliarti": "c-0106",
    "oficiais": "ignore",
    "auxiliardemanutencao": "ignore",
    "assistentedealmoxarifado": "ignore",
    "assistentedemanutencao": "ignore",
    "coordenadordeseguranca": "ignore",
    "experienciapos90dias": "per",
};

function getCode(roleName) {
    const norm = normalize(roleName);
    if (manualMap[norm]) return manualMap[norm];
    if (roleCodeMap[norm]) return roleCodeMap[norm];
    
    // partial matching
    for (const k of Object.keys(roleCodeMap)) {
        if (norm.includes(k) || k.includes(norm)) return roleCodeMap[k];
    }
    return null;
}

const excelData = JSON.parse(fs.readFileSync('scratch/tabela_salarial.json', 'utf8'));
const insertValues = [];

function processSheet(sheetName) {
    const rows = excelData[sheetName];
    
    let currentSeniorities = {}; // colKey -> seniority string (e.g. "Júnior")
    let currentColumns = []; // { colKey, level, seniority }
    let currentSalaryMap = []; // { modality, level, seniority, salary }
    
    for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        const keys = Object.keys(row);
        
        let hasSeniorityMarker = false;
        let hasLevelMarker = false;
        
        // Detect Seniority row
        for (const k of keys) {
            const val = row[k];
            if (typeof val === 'string' && (val.includes('JUNIOR') || val.includes('PLENO') || val.includes('SENIOR'))) {
                hasSeniorityMarker = true;
            }
        }
        
        // Detect Level row
        for (const k of keys) {
            const val = row[k];
            if (typeof val === 'string' && (val.includes('Nível') || val.includes('Trainee') || val.includes('Experiência') || val.includes('90 dias') || val.includes('Nivel'))) {
                hasLevelMarker = true;
            }
        }
        
        if (hasSeniorityMarker) {
            currentSeniorities = {};
            let lastSen = null;
            for (let i = 1; i <= 30; i++) {
                const k = i === 1 ? '__EMPTY_1' : `__EMPTY_${i}`;
                if (row[k] && typeof row[k] === 'string') {
                    if (row[k].includes('JUNIOR')) lastSen = 'Júnior';
                    if (row[k].includes('PLENO')) lastSen = 'Pleno';
                    if (row[k].includes('SENIOR')) lastSen = 'Sênior';
                }
                if (lastSen) currentSeniorities[k] = lastSen;
            }
            continue;
        }
        
        if (hasLevelMarker) {
            currentColumns = [];
            currentSalaryMap = []; // reset salary map
            
            // if previous row was NOT seniority, clear seniorities
            if (r > 0) {
                const prevRow = rows[r-1];
                const prevKeys = Object.keys(prevRow);
                let prevWasSen = false;
                for (const pk of prevKeys) {
                    if (typeof prevRow[pk] === 'string' && (prevRow[pk].includes('JUNIOR') || prevRow[pk].includes('PLENO') || prevRow[pk].includes('SENIOR'))) {
                        prevWasSen = true;
                    }
                }
                if (!prevWasSen) currentSeniorities = {};
            }
            
            for (const k of keys) {
                const val = row[k];
                if (typeof val === 'string' && val.trim() !== '') {
                    // Ignore column A (__EMPTY usually)
                    if (k === '__EMPTY') continue;
                    let level = val.trim();
                    let sen = currentSeniorities[k] || null;
                    currentColumns.push({ colKey: k, level, seniority: sen });
                }
            }
            continue;
        }
        
        // Is it a Modality/Salary row?
        const col1 = row['__EMPTY_1'];
        if (typeof col1 === 'string' && (col1 === 'CLT' || col1 === 'PJ' || col1 === 'Mei')) {
            const modality = col1 === 'Mei' ? 'PJ' : col1;
            for (const col of currentColumns) {
                const salary = row[col.colKey];
                if (typeof salary === 'number' && salary > 0) {
                    currentSalaryMap.push({
                        modality,
                        level: col.level,
                        seniority: col.seniority,
                        salary
                    });
                }
            }
            continue;
        }
        
        if (typeof col1 === 'string' && col1.length > 3 && !col1.includes('Cargos | Áreas') && !col1.includes('Experiência |')) {
            const roleName = col1.trim();
            const code = getCode(roleName);
            if (code && code !== 'ignore' && code !== 'per') {
                for (const sm of currentSalaryMap) {
                    insertValues.push(`('${code}', '${roleName.replace(/'/g, "''")}', '${sm.level}', ${sm.seniority ? `'${sm.seniority}'` : 'NULL'}, '${sm.modality}', ${sm.salary})`);
                }
            } else if (!code) {
                console.warn(`Could not find code for role: ${roleName}`);
            }
        }
    }
}

processSheet('Administrativo');
processSheet('Engenharia');
processSheet('Operacional');

const chunkSize = 100;
let fileIndex = 1;

fs.writeFileSync('scratch/insert_salaries_0.sql', 'DELETE FROM salary_table;\n', 'utf8');

for (let i = 0; i < insertValues.length; i += chunkSize) {
    const chunk = insertValues.slice(i, i + chunkSize);
    const sql = `INSERT INTO salary_table (role_code, role_name, level, seniority, modality, salary) VALUES\n${chunk.join(',\n')};`;
    fs.writeFileSync(`scratch/insert_salaries_${fileIndex}.sql`, sql, 'utf8');
    fileIndex++;
}

console.log(`Generated ${insertValues.length} salary records across ${fileIndex - 1} files`);
