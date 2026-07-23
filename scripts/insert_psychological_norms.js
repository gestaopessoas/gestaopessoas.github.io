const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'C:/Users/ACPO Empreendimentos/Documents/GitHub/gestaopessoas.github.io/.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const json = JSON.parse(fs.readFileSync('C:/Users/ACPO Empreendimentos/Desktop/tabelas_psicologicas.json', 'utf8'));
  console.log(`Found ${json.length} records. Starting insertion...`);

  // First delete existing data to avoid duplicates if rerun
  const { error: delError } = await supabase.from('psychological_norms').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delError) {
    console.error('Error deleting old data:', delError);
  } else {
    console.log('Old data cleared.');
  }

  // Insert in chunks of 500
  const CHUNK_SIZE = 500;
  for (let i = 0; i < json.length; i += CHUNK_SIZE) {
    const chunk = json.slice(i, i + CHUNK_SIZE).map(row => ({
      test_name: row.test_name || '',
      table_name: row.table_name || '',
      demographic_type: row.demographic_type || '',
      demographic_value: row.demographic_value || '',
      factor: row.factor || null,
      min_score: typeof row.min_score === 'number' ? row.min_score : 0,
      max_score: typeof row.max_score === 'number' ? row.max_score : 0,
      percentile: typeof row.percentile === 'number' ? row.percentile : 0,
      classification: row.classification || ''
    }));

    const { error } = await supabase.from('psychological_norms').insert(chunk);
    if (error) {
      console.error(`Error inserting chunk at index ${i}:`, error);
    } else {
      console.log(`Inserted chunk ${i} to ${i + chunk.length}`);
    }
  }

  console.log('Insertion complete.');
}

run();
