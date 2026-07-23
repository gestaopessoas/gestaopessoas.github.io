import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'C:/Users/ACPO Empreendimentos/Documents/GitHub/gestaopessoas.github.io/.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function getDemographicType(title) {
    const t = title.toLowerCase();
    if (t.includes('sexo')) return 'Sexo';
    if (t.includes('escolaridade')) return 'Escolaridade';
    if (t.includes('idade') || t.includes('faixa etária') || t.includes('faixas etárias')) return 'Faixa Etária';
    if (t.includes('região') || t.includes('estado')) return 'Região';
    if (t.includes('cnh')) return 'CNH';
    return 'Geral';
}

function processTest(testName, filePath) {
    if (!fs.existsSync(filePath)) return [];
    
    const d = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const allNorms = [];

    for (const table of d.tables) {
        const tName = `Tabela ${table.table_number}`;
        const demoType = getDemographicType(table.title);
        
        for (let i = 0; i < table.data.length; i++) {
            const row = table.data[i];
            
            for (const col of table.columns) {
                let score = row.scores[col];
                if (score === undefined || score === null) continue;
                
                let minScore = 0;
                let maxScore = 0;
                
                if (typeof score === 'string') {
                    score = score.trim();
                    if (score.includes(' a ')) {
                        const parts = score.split(' a ');
                        minScore = parseInt(parts[0], 10);
                        maxScore = parseInt(parts[1], 10);
                    } else if (score.includes('-')) {
                        const parts = score.split('-');
                        minScore = parseInt(parts[0], 10);
                        maxScore = parseInt(parts[1], 10);
                    } else if (score.startsWith('<') || score.startsWith('≤')) {
                        minScore = -999;
                        maxScore = parseInt(score.replace(/[^0-9-]/g, ''), 10);
                    } else if (score.startsWith('>') || score.startsWith('≥')) {
                        minScore = parseInt(score.replace(/[^0-9-]/g, ''), 10);
                        maxScore = 999;
                    } else {
                        minScore = parseInt(score, 10);
                        maxScore = minScore;
                    }
                } else if (typeof score === 'number') {
                    minScore = score;
                    maxScore = score;
                }
                
                if (isNaN(minScore)) minScore = -999;
                if (isNaN(maxScore)) maxScore = 999;
                
                allNorms.push({
                    test_name: testName,
                    table_name: tName,
                    demographic_type: demoType,
                    demographic_value: col,
                    min_score: minScore,
                    max_score: maxScore,
                    percentile: row.percentil || 0,
                    classification: row.classificacao || ''
                });
            }
        }
    }
    return allNorms;
}

async function run() {
  const teadiPath = 'C:/Users/ACPO Empreendimentos/Documents/Github/gestaopessoas.github.io/src/data/teadi_norms.json';
  const tealtPath = 'C:/Users/ACPO Empreendimentos/Documents/Github/gestaopessoas.github.io/src/data/tealt_norms.json';
  const g36Path = 'C:/Users/ACPO Empreendimentos/Documents/Github/gestaopessoas.github.io/src/data/g36_norms.json';
  
  const teadiNorms = processTest('TEADI', teadiPath);
  if (teadiNorms.length > 0) {
      console.log(`TEADI data: ${teadiNorms.length} records`);
      const { error: delError } = await supabase.from('psychological_norms').delete().eq('test_name', 'TEADI');
      if (delError) console.error('Error deleting TEADI:', delError);
      
      const CHUNK_SIZE = 500;
      for (let i = 0; i < teadiNorms.length; i += CHUNK_SIZE) {
          const chunk = teadiNorms.slice(i, i + CHUNK_SIZE);
          const { error } = await supabase.from('psychological_norms').insert(chunk);
          if (error) console.error(`Error TEADI chunk ${i}:`, error);
      }
      console.log('Finished inserting TEADI');
  }

  const tealtNorms = processTest('TEALT', tealtPath);
  if (tealtNorms.length > 0) {
      console.log(`TEALT data: ${tealtNorms.length} records`);
      const { error: delError } = await supabase.from('psychological_norms').delete().eq('test_name', 'TEALT');
      if (delError) console.error('Error deleting TEALT:', delError);
      
      const CHUNK_SIZE = 500;
      for (let i = 0; i < tealtNorms.length; i += CHUNK_SIZE) {
          const chunk = tealtNorms.slice(i, i + CHUNK_SIZE);
          const { error } = await supabase.from('psychological_norms').insert(chunk);
          if (error) console.error(`Error TEALT chunk ${i}:`, error);
      }
      console.log('Finished inserting TEALT');
  }

  const g36Norms = processTest('G36', g36Path);
  if (g36Norms.length > 0) {
      console.log(`G36 data: ${g36Norms.length} records`);
      const { error: delError } = await supabase.from('psychological_norms').delete().eq('test_name', 'G36');
      if (delError) console.error('Error deleting G36:', delError);
      
      const CHUNK_SIZE = 500;
      for (let i = 0; i < g36Norms.length; i += CHUNK_SIZE) {
          const chunk = g36Norms.slice(i, i + CHUNK_SIZE);
          const { error } = await supabase.from('psychological_norms').insert(chunk);
          if (error) console.error(`Error G36 chunk ${i}:`, error);
      }
      console.log('Finished inserting G36');
  }
}

run().catch(console.error);
