import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function removeAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getFirstTwoWords(str) {
  const words = str.split(' ');
  return words.length > 1 ? `${words[0]} ${words[1]}` : words[0];
}

async function run() {
  const { data, error } = await supabase.from('employees').select('*');
  if (error) {
    console.error('Error fetching employees:', error);
    return;
  }

  const output = [];

  for (let i = 0; i < data.length; i++) {
    for (let j = i + 1; j < data.length; j++) {
      const e1 = data[i];
      const e2 = data[j];
      
      const n1 = removeAccents(e1.name.trim().toLowerCase().replace(/\s+/g, ' '));
      const n2 = removeAccents(e2.name.trim().toLowerCase().replace(/\s+/g, ' '));
      
      const w1 = getFirstTwoWords(n1);
      const w2 = getFirstTwoWords(n2);

      let isSim = false;
      if (w1 === w2) {
         isSim = true;
      }

      if (isSim) {
         output.push({
             emp1: e1,
             emp2: e2
         });
      }
    }
  }

  console.log(`Found ${output.length} potential duplicate pairs.`);

  fs.writeFileSync('duplicates_analysis.json', JSON.stringify(output, null, 2));
  console.log('Saved to duplicates_analysis.json');
}

run();
