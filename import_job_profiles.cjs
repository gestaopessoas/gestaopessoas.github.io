const fs = require('fs');
const pdf = require('pdf-parse');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env', 'utf-8');
let url = '', key = '';
env.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});
const supabase = createClient(url, key);

const pdfPath = 'C:\\Users\\ACPO Empreendimentos\\CONSTRUTORA ACPO LTDA\\Recursos Humanos - Documentos\\Gestão de Pessoas\\5. Plano de Carreira\\4. Perfil de Competências\\Perfil de competências 2025 Modelo rev_34.pdf';

async function importProfiles() {
    const dataBuffer = fs.readFileSync(pdfPath);
    let data;
    try {
        data = await pdf(dataBuffer);
    } catch(e) {
        console.error("PDF PARSE FAILED", e);
        return;
    }
    const text = data.text;
    
    const profiles = [];
    const blocks = text.split("Código do perfil");
    
    for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        
        const lines = block.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length < 5) continue;
        
        let profileCode = "";
        let cbo = "";
        
        let cLineIdx = lines.findIndex(l => l.includes('C-0'));
        if (cLineIdx !== -1) {
            let cLine = lines[cLineIdx];
            let parts = cLine.split(/\s+/);
            profileCode = parts[0];
            cbo = parts.length > 1 ? parts[1] : "";
            if (!cbo && lines.length > cLineIdx + 1 && /^\d+/.test(lines[cLineIdx+1])) {
                cbo = lines[cLineIdx+1];
            }
        }
        
        if (!profileCode || !profileCode.startsWith('C-')) continue;

        let prevLines = blocks[i-1].split('\n').map(l => l.trim()).filter(l => l);
        let title = "";
        for (let j = prevLines.length - 1; j >= 0; j--) {
            let l = prevLines[j];
            if (l.length > 2 && !l.includes('Competências') && !l.includes('Atividades')) {
                title = l;
                break;
            }
        }
        
        let min_education = extractField(block, 'Escolaridade', 'Experiência');
        let min_experience = extractField(block, 'Experiência', 'CNH');
        let cnh = extractField(block, 'CNH', 'Conhecimentos');
        let knowledge = extractField(block, 'Conhecimentos', 'Descrição do cargo');
        
        let actCompBlock = extractField(block, 'Descrição do cargo', 'Código do perfil');
        let activities = "";
        let competencies = "";
        
        if (actCompBlock) {
             let acLines = actCompBlock.split('\n');
             let mode = 0; 
             for (let cl of acLines) {
                 if (cl.includes('Atividades') && cl.includes('Competências')) {
                     mode = 1; continue;
                 }
                 if (mode === 1) {
                     activities += cl + "\n";
                 }
             }
        }

        profiles.push({
            profile_code: profileCode,
            title: title.substring(0, 100),
            cbo: cbo,
            min_education: min_education.substring(0, 255),
            min_experience: min_experience.substring(0, 255),
            cnh: cnh.substring(0, 50),
            knowledge: knowledge.substring(0, 1000),
            activities: activities.substring(0, 2000),
            competencies: competencies.substring(0, 1000)
        });
    }

    console.log(`Extraiu ${profiles.length} perfis. Inserindo no Supabase...`);
    
    let c = 0;
    for (const p of profiles) {
        const { error } = await supabase.from('job_profiles').upsert(p, { onConflict: 'profile_code' });
        if (error) {
            console.error("Erro inserindo", p.profile_code, error);
        } else {
            c++;
        }
    }
    
    console.log(`Concluído. ${c} perfis inseridos/atualizados.`);
}

function extractField(text, startKey, endKey) {
    let startIdx = text.indexOf(startKey);
    if (startIdx === -1) return "";
    let endIdx = text.indexOf(endKey, startIdx);
    if (endIdx === -1) endIdx = text.length;
    let content = text.substring(startIdx + startKey.length, endIdx).trim();
    return content;
}

importProfiles();
