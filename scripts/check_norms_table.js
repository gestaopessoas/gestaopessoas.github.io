require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('psychological_norms').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success, table exists. Data:', data);
  }
}
check();
