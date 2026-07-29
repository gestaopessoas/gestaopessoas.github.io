const fs = require('fs');

const dbRoles = JSON.parse(fs.readFileSync('scratch/db_roles.json', 'utf8'));
const excelData = JSON.parse(fs.readFileSync('scratch/tabela_salarial.json', 'utf8'));

function normalize(str) {
    if (!str) return '';
    return str.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9]/g, ''); 
}

const dbRoleNormalized = dbRoles.map(r => normalize(r.title));

let excelRoles = [];
for (const sheet of ['Administrativo', 'Engenharia', 'Operacional']) {
    for (const row of excelData[sheet]) {
        const val = row['__EMPTY'] || row['Cargo'] || Object.values(row)[0];
        if (typeof val === 'string' && val.length > 3 && val !== 'CLT' && val !== 'PJ' && !val.includes('Nível') && !val.includes('Carreira') && !val.includes('Experiência') && val !== 'Pós - 90 dias') {
            excelRoles.push(val.trim());
        }
    }
}

// Remove duplicates
excelRoles = [...new Set(excelRoles)];

const missingRoles = [];
for (const role of excelRoles) {
    if (!dbRoleNormalized.includes(normalize(role))) {
        missingRoles.push(role);
    }
}

console.log("Missing Roles in DB from Excel:");
if (missingRoles.length === 0) {
    console.log("None! All Excel roles are in the DB.");
} else {
    console.log(missingRoles.join('\n'));
}
