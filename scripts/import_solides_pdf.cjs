const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf-8');
let url = '', key = '';
env.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);
const data = JSON.parse(fs.readFileSync('colaboradores_extraidos.json', 'utf-8'));

async function run() {
    let deptsMap = {};
    const { data: dData } = await supabase.from('departments').select('id, name');
    if (dData) {
        dData.forEach(d => deptsMap[d.name.trim().toUpperCase()] = d.id);
    }

    let updCount = 0;
    let newCount = 0;

    for (let r of data) {
        let deptId = deptsMap[r.departamento.toUpperCase()];
        if (!deptId) {
            const { data: newD } = await supabase.from('departments').insert({ name: r.departamento }).select('id').single();
            if (newD) {
                deptId = newD.id;
                deptsMap[r.departamento.toUpperCase()] = deptId;
            }
        }

        let record = {
            name: r.nome,
            role: r.cargo,
            department_id: deptId,
            email_corporate: r.email,
            workplace: r.unidade,
            status: 'Ativo'
        };

        const { data: exist } = await supabase.from('employees').select('id').eq('name', r.nome).maybeSingle();
        
        if (exist) {
            let { error } = await supabase.from('employees').update(record).eq('id', exist.id);
            if (error && error.code === 'PGRST204') { // Column doesn't exist yet
                delete record.workplace;
                let fallback = await supabase.from('employees').update(record).eq('id', exist.id);
                if (fallback.error) console.error("Error updating fallback", r.nome, fallback.error);
                else updCount++;
            } else if (error) {
                console.error("Error updating", r.nome, error);
            } else {
                updCount++;
            }
        } else {
            let { error } = await supabase.from('employees').insert(record);
            if (error && error.code === 'PGRST204') {
                delete record.workplace;
                let fallback = await supabase.from('employees').insert(record);
                if (fallback.error) console.error("Error inserting fallback", r.nome, fallback.error);
                else newCount++;
            } else if (error) {
                console.error("Error inserting", r.nome, error);
            } else {
                newCount++;
            }
        }
    }
    console.log(`Finalizado! Atualizados: ${updCount}, Novos Inseridos: ${newCount}. Total: ${updCount + newCount}`);
}

run();
