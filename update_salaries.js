const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateSalaries() {
    console.log("Loading custos_geral.json...");
    const custosPath = "C:/Users/ACPO Empreendimentos/.gemini/antigravity/brain/cdabee16-7d60-4be9-9d46-c848215f92a7/scratch/custos_geral.json";
    const data = JSON.parse(fs.readFileSync(custosPath, 'utf8'));

    console.log("Fetching employees from DB...");
    const { data: employees, error } = await supabase.from('employees').select('id, name, registration_number');
    if (error) {
        console.error("Error fetching employees:", error);
        return;
    }

    const employeeMap = {}; // by registration_number
    const employeeMapByName = {}; // by name

    for (const emp of employees) {
        if (emp.registration_number) {
            employeeMap[emp.registration_number.toString()] = emp.id;
        }
        if (emp.name) {
            employeeMapByName[emp.name.trim().toLowerCase()] = emp.id;
        }
    }

    let updatedCount = 0;
    let notFoundCount = 0;

    for (const row of data) {
        // Only update active ones in Custos (as requested)
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
            const encargos = row.encargos ? parseFloat(row.encargos) : 0;
            const level = row.plano_carreira ? row.plano_carreira.toString().trim() : null;

            const updatePayload = {
                base_salary: base,
                variable_salary: variable,
                encargos: encargos, // We hope 'encargos' is a column. If it errors, we will see.
                level: level
            };

            const { error: updErr } = await supabase.from('employees').update(updatePayload).eq('id', empId);
            if (updErr) {
                console.error(`Error updating ${row.nome}:`, updErr.message);
                // Try without encargos if that's the error
                if (updErr.message.includes('encargos')) {
                    delete updatePayload.encargos;
                    await supabase.from('employees').update(updatePayload).eq('id', empId);
                    console.log(`Updated without encargos column for ${row.nome}`);
                }
            } else {
                updatedCount++;
            }
        } else {
            notFoundCount++;
            console.log(`Not found in DB: ${row.nome} (Matricula: ${row.matricula})`);
        }
    }

    console.log(`Update complete. Updated: ${updatedCount}. Not found: ${notFoundCount}`);
}

updateSalaries();
