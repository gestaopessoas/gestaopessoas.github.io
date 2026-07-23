import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'C:/Users/ACPO Empreendimentos/Documents/GitHub/gestaopessoas.github.io/.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  // List all distinct test_names in the table
  const { data: tests, error: e1 } = await supabase
    .from('psychological_norms')
    .select('test_name')
    .limit(1000);

  if (e1) { console.error('Error:', e1); return; }

  const counts = {};
  for (const row of tests) {
    counts[row.test_name] = (counts[row.test_name] || 0) + 1;
  }
  console.log('Distinct test_names (from first 1000 rows):', counts);

  // Sample a few rows
  const { data: sample, error: e2 } = await supabase
    .from('psychological_norms')
    .select('*')
    .limit(5);

  if (e2) { console.error('Error:', e2); return; }
  console.log('\nSample rows:');
  for (const r of sample) console.log(JSON.stringify(r));

  // Check total count
  const { count, error: e3 } = await supabase
    .from('psychological_norms')
    .select('*', { count: 'exact', head: true });

  if (e3) { console.error('Error:', e3); return; }
  console.log('\nTotal rows in table:', count);

  // Check table name and columns
  const { data: g36sample, error: e4 } = await supabase
    .from('psychological_norms')
    .select('*')
    .eq('test_name', 'G36')
    .limit(5);

  if (e4) { console.error('Error:', e4); return; }
  console.log('\nG36 sample:');
  for (const r of g36sample) console.log(JSON.stringify(r));
}

check().catch(console.error);
