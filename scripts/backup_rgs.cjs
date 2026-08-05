const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  let all = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await supabase.from('rgs_processes').select('*').range(from, from + step - 1);
    if (error) throw error;
    all = all.concat(data);
    if (data.length < step) break;
    from += step;
  }
  const outPath = `backups/rgs_processes_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(outPath, JSON.stringify(all, null, 2));
  console.log(`Backup salvo: ${outPath} (${all.length} registros)`);
}

run().catch((e) => { console.error(e); process.exit(1); });
