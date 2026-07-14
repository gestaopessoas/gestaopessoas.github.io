const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const env = fs.readFileSync('.env', 'utf-8');

let url = '', key = '';
env.split('\n').forEach(line => {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

function parseDate(dateStr) {
    if (!dateStr || dateStr.toLowerCase() === 'não preenchido') return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return null;
}

function parseValue(val) {
    if (!val || val.toLowerCase() === 'não preenchido' || val === 'undefined') return null;
    return val.trim();
}

async function run() {
    const downloadsDir = 'C:\\Users\\ACPO Empreendimentos\\Downloads';
    const files = fs.readdirSync(downloadsDir).filter(f => f.endsWith('_dados_colaborador.md'));
    
    console.log(`Encontrados ${files.length} arquivos.`);
    
    // Buscar funcionários existentes
    const { data: employees, error: fetchErr } = await supabase.from('employees').select('id, name');
    if (fetchErr) {
        console.error("Erro ao buscar funcionários:", fetchErr);
        return;
    }
    
    let updatedCount = 0;
    
    for (const file of files) {
        const content = fs.readFileSync(path.join(downloadsDir, file), 'utf-8');
        const lines = content.split('\n');
        
        const data = {};
        for (const line of lines) {
            const match = line.match(/-\s+\*\*([^*]+):\*\*\s*(.*)/);
            if (match) {
                const key = match[1].trim();
                const val = parseValue(match[2]);
                
                if (key === 'Nome Completo') data.name = val;
                if (key === 'Data de Nascimento') data.birthday = parseDate(val);
                if (key === 'CPF') data.cpf = val;
                if (key === 'RG') data.rg = val;
                if (key === 'Sexo') data.gender = val;
                if (key === 'Estado Civil') data.marital_status = val;
                if (key === 'Celular') data.phone = val;
                if (key === 'E-mail Corporativo') data.email_corporate = val;
                if (key === 'E-mail Pessoal') data.email_personal = val;
                if (key === 'PIS/PASEP') data.pis = val;
                if (key === 'CTPS Num') data.ctps = val;
                if (key === 'CTPS Série') data.ctps_serie = val;
            }
        }
        
        if (!data.name) continue;
        
        // Find match in DB
        const cleanName = (n) => (n||'').toLowerCase().replace(/\s+/g, ' ').trim();
        const targetName = cleanName(data.name);
        
        const dbRecord = employees.find(e => cleanName(e.name) === targetName);
        if (dbRecord) {
            const updatePayload = {};
            if (data.birthday) updatePayload.birthday = data.birthday;
            if (data.cpf) updatePayload.cpf = data.cpf;
            if (data.rg) updatePayload.rg = data.rg;
            if (data.gender) updatePayload.gender = data.gender;
            if (data.marital_status) updatePayload.marital_status = data.marital_status;
            if (data.phone) updatePayload.phone = data.phone;
            if (data.email_corporate) updatePayload.email_corporate = data.email_corporate;
            if (data.email_personal) updatePayload.email_personal = data.email_personal;
            if (data.pis) updatePayload.pis = data.pis;
            if (data.ctps) updatePayload.ctps = data.ctps;
            if (data.ctps_serie) updatePayload.ctps_serie = data.ctps_serie;
            
            if (Object.keys(updatePayload).length > 0) {
                const { error: updErr } = await supabase.from('employees').update(updatePayload).eq('id', dbRecord.id);
                if (updErr) {
                    console.error(`Erro ao atualizar ${data.name}:`, updErr.message);
                } else {
                    console.log(`✅ Atualizado: ${data.name}`);
                    updatedCount++;
                }
            }
        } else {
            console.log(`⚠️ Não encontrado no banco: ${data.name}`);
        }
    }
    
    console.log(`\nConcluído! ${updatedCount} registros foram atualizados com os dados completos.`);
}

run();
