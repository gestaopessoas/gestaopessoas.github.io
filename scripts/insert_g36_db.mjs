import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'C:/Users/ACPO Empreendimentos/Documents/GitHub/gestaopessoas.github.io/.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function getDemographicType(title) {
    const t = title.toLowerCase();
    if (t.includes('escolaridade')) return 'Escolaridade';
    if (t.includes('indústria') || t.includes('serviço') || t.includes('recife')) return 'Setor';
    return 'Geral';
}

const g36Path = 'C:/Users/ACPO Empreendimentos/Documents/Github/gestaopessoas.github.io/src/data/g36_norms.json';
const d = JSON.parse(fs.readFileSync(g36Path, 'utf8'));

const allNorms = [];

for (const table of d.tables) {
    const tName = `Tabela ${table.table_number}`;
    const demoType = getDemographicType(table.title);

    for (const row of table.data) {
        for (const col of table.columns) {
            let score = row.scores[col];
            if (score === undefined || score === null) continue;

            let minScore, maxScore;
            if (typeof score === 'string') {
                score = score.trim();
                if (score.includes('-')) {
                    const parts = score.split('-').map(s => parseInt(s.trim(), 10));
                    minScore = Math.min(...parts);
                    maxScore = Math.max(...parts);
                } else {
                    minScore = maxScore = parseInt(score, 10);
                }
            } else {
                minScore = maxScore = score;
            }

            if (isNaN(minScore) || isNaN(maxScore)) continue;

            allNorms.push({
                test_name: 'G36',
                table_name: tName,
                demographic_type: demoType,
                demographic_value: col,
                min_score: minScore,
                max_score: maxScore,
                percentile: row.percentil,
                classification: row.classificacao || ''
            });
        }
    }
}

console.log(`G36 prepared: ${allNorms.length} records`);

const { error: delError } = await supabase.from('psychological_norms').delete().eq('test_name', 'G36');
if (delError) { console.error('Delete error:', delError); process.exit(1); }

const CHUNK = 500;
for (let i = 0; i < allNorms.length; i += CHUNK) {
    const { error } = await supabase.from('psychological_norms').insert(allNorms.slice(i, i + CHUNK));
    if (error) console.error(`Chunk ${i} error:`, error);
    else console.log(`Inserted chunk ${i}–${Math.min(i + CHUNK, allNorms.length)}`);
}

console.log('G36 done!');
