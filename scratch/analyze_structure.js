const fs = require('fs');

const excelData = JSON.parse(fs.readFileSync('scratch/tabela_salarial.json', 'utf8'));

for (const sheet of ['Administrativo', 'Engenharia', 'Operacional']) {
    console.log(`\n=========================================`);
    console.log(`=== ABA: ${sheet.toUpperCase()} ===`);
    console.log(`=========================================\n`);
    
    let currentHeader = "Unknown Header";
    
    for (const row of excelData[sheet]) {
        // usually the hierarchy header is in __EMPTY (col A), e.g. "3 - Analista Júnior"
        // and the specific roles are also in __EMPTY or __EMPTY_1
        
        // Let's check the structure. In the JSON we saw:
        // { "__EMPTY": "3 - Analista Júnior", "ADMINISTRATIVO": ... } -> This is from Conferência!
        // Wait, in Administrativo, the rows are:
        // { "__EMPTY": null, "__EMPTY_1": "Auxiliar Administrativo" }
        // The hierarchy headers might be above them. How does the Excel indicate "Analista Junior" in the Administrativo sheet?
        // Let's print rows that have only 1 or 2 keys, or rows that look like headers.
        
        const keys = Object.keys(row);
        let text = '';
        for (const k of keys) {
            if (typeof row[k] === 'string' && row[k].trim() !== '') {
                text += row[k] + " | ";
            }
        }
        
        if (text.includes('Nível') || text.includes('CLT') || text.includes('PJ')) {
            continue; // skip salary matrix headers
        }
        
        if (text) {
            // Remove trailing ' | '
            text = text.slice(0, -3);
            
            // Check if it's a structural header (like "3 - Analista Júnior" or "Liderança") or a specific role
            if (text.match(/^\d+\s*-/)) { // e.g. "3 - Analista"
                console.log(`\n[HIERARQUIA] ${text}`);
            } else if (text.toLowerCase().includes('júnior') || text.toLowerCase().includes('pleno') || text.toLowerCase().includes('sênior')) {
                console.log(`[SUB-NÍVEL / CARGO] ${text}`);
            } else if (!text.includes('Cargos') && !text.includes('Carreira') && !text.includes('Estágio') && text.length > 3) {
                console.log(`  -> Cargo: ${text}`);
            }
        }
    }
}
