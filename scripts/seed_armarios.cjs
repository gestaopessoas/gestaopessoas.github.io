const { supabase } = require('./lib/supabaseClient.cjs');

async function main() {
  console.log('Apagando armários antigos...');
  await supabase.from('lockers').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('Inserindo nova estrutura de armários...');
  const lockers = [];
  
  for (let i = 1; i <= 32; i++) {
    lockers.push({ number: `Vertical ${String(i).padStart(2, '0')}` });
  }
  for (let i = 1; i <= 14; i++) {
    lockers.push({ number: `Horizontal ${String(i).padStart(2, '0')}` });
  }

  const { error } = await supabase.from('lockers').insert(lockers);
  if (error) {
    console.error('Erro ao inserir:', error);
  } else {
    console.log('Armários criados com sucesso!');
  }
}
main();
