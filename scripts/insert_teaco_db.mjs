import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'C:/Users/ACPO Empreendimentos/Documents/GitHub/gestaopessoas.github.io/.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const teacoDir = path.join(__dirname, '..', 'src', 'teaco');

async function run() {
  const files = fs.readdirSync(teacoDir).filter(f => f.startsWith('tabela') && f.endsWith('.js'));
  let allNorms = [];

  for (const file of files) {
    const filePath = `file:///${path.join(teacoDir, file).replace(/\\/g, '/')}`;
    const module = await import(filePath);
    const varName = Object.keys(module)[0];
    const tableData = module[varName];

    const tableName = tableData.nome;
    const desc = tableData.descricao;
    // demographic_type is usually derived from description, but we can just put a generic one or extract it
    let demographicType = '';
    if (desc.toLowerCase().includes('sexo')) demographicType = 'Sexo';
    else if (desc.toLowerCase().includes('escolaridade')) demographicType = 'Escolaridade';
    else if (desc.toLowerCase().includes('faixa etária') || desc.toLowerCase().includes('faixas etárias')) demographicType = 'Faixa Etária';
    else if (desc.toLowerCase().includes('região') || desc.toLowerCase().includes('estado')) demographicType = 'Região';
    else if (desc.toLowerCase().includes('cnh')) demographicType = 'CNH';
    else demographicType = 'Geral';
    
    // We process each row
    const cols = tableData.colunas.filter(c => c.toLowerCase() !== 'percentil' && c.toLowerCase() !== 'classificacao' && c.toLowerCase() !== 'classificação');
    
    for (let i = 0; i < tableData.dados.length; i++) {
        const row = tableData.dados[i];
        const nextRow = tableData.dados[i + 1];
        const percentile = row.percentil;
        const classification = row.classificacao || row.classificação || '';

        for (const col of cols) {
            let score = row[col];
            if (score === undefined) continue;

            // In TEACO, sometimes score is a single number.
            // min_score and max_score logic: 
            // the score listed is the score required to achieve that percentile.
            // If nextRow has a score, does the range go up to it?
            // Usually, min_score = score, max_score = score, since the test gives integer scores.
            let minScore = score;
            let maxScore = score;

            // Wait, if it's a string like "2 a 4", we parse it, but I used numbers mostly in TEACO.
            if (typeof score === 'string') {
                if (score.includes(' a ')) {
                    const parts = score.split(' a ');
                    minScore = parseInt(parts[0], 10);
                    maxScore = parseInt(parts[1], 10);
                } else if (score.includes('-')) {
                    const parts = score.split('-');
                    minScore = parseInt(parts[0], 10);
                    maxScore = parseInt(parts[1], 10);
                } else if (score.startsWith('<') || score.startsWith('≤')) {
                    minScore = 0;
                    maxScore = parseInt(score.replace(/\D/g, ''), 10);
                } else if (score.startsWith('>') || score.startsWith('≥')) {
                    minScore = parseInt(score.replace(/\D/g, ''), 10);
                    maxScore = 999;
                } else {
                    minScore = parseInt(score, 10);
                    maxScore = minScore;
                }
            }
            if (isNaN(minScore)) minScore = 0;
            if (isNaN(maxScore)) maxScore = 0;

            allNorms.push({
                test_name: 'TEACO',
                table_name: tableName,
                demographic_type: demographicType,
                demographic_value: col,
                factor: null,
                min_score: minScore,
                max_score: maxScore,
                percentile: percentile,
                classification: classification
            });
        }
    }
  }

  console.log(`Prepared ${allNorms.length} norms for TEACO.`);
  
  // Now let's just insert them, or we can first delete existing TEACO norms
  const { error: delError } = await supabase.from('psychological_norms').delete().eq('test_name', 'TEACO');
  if (delError) {
      console.error('Error deleting old TEACO norms:', delError);
      return;
  }
  console.log('Deleted old TEACO norms.');

  const CHUNK_SIZE = 500;
  for (let i = 0; i < allNorms.length; i += CHUNK_SIZE) {
      const chunk = allNorms.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from('psychological_norms').insert(chunk);
      if (error) {
          console.error(`Error inserting chunk ${i}:`, error);
      } else {
          console.log(`Inserted chunk ${i} to ${i + chunk.length}`);
      }
  }

  console.log('Done inserting TEACO norms!');
}

run().catch(console.error);
