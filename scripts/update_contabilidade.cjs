const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf-8');
const VITE_SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const VITE_SUPABASE_ANON_KEY = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log('Fetching employees...');
  
  const idFernanda = '5358afef-8572-443a-be74-3d124a07baa3'; // FERNANDA CLENIR HERNANDES MACHADO
  const idBruna = 'aed9c941-44e4-4820-9ecc-c44e7399d339'; // BRUNA VALERIA
  const idVitoria = '4e6e886e-8957-4342-9820-651b0b292b4f'; // VITORIA ROSARIO
  
  // CLEO GOMES might not exist by that exact name, I'll leave null or find best match later
  const { data: cleos } = await supabase.from('employees').select('id, name').ilike('name', '%CLEO%GOMES%').limit(1);
  const idCleo = cleos && cleos.length > 0 ? cleos[0].id : null;

  console.log({ idFernanda, idBruna, idVitoria, idCleo });

  console.log('Deleting old Contabilidade desks...');
  await supabase.from('islands').delete().eq('sector', 'Contabilidade');

  console.log('Inserting new desks...');
  
  const desksToInsert = [
    { name: 'Mesa 1 (Vazia)', sector: 'Contabilidade', employee_id: null, position_index: 0 },
    { name: 'Mesa Fernanda', sector: 'Contabilidade', employee_id: idFernanda, position_index: 1 },
    { name: 'Mesa Bruna', sector: 'Contabilidade', employee_id: idBruna, position_index: 2 },
    { name: 'ESPAÇO VAZIO', sector: 'Contabilidade', employee_id: null, position_index: 3 },
    { name: 'Mesa Vitoria', sector: 'Contabilidade', employee_id: idVitoria, position_index: 4 },
    { name: 'Mesa Cleo', sector: 'Contabilidade', employee_id: idCleo, position_index: 5 }
  ];

  const { error } = await supabase.from('islands').insert(desksToInsert);
  if (error) console.error(error);
  else console.log('Inserted correctly!');
}

run().catch(console.error);
