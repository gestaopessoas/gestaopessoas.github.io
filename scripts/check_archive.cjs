const { supabase } = require('./lib/supabaseClient.cjs');

async function main() {
  const { data: deadArchive, error: err1 } = await supabase.from('employees').select('id, name, status').eq('status', 'Arquivo Morto');
  console.log('Arquivo Morto count:', deadArchive ? deadArchive.length : 0);
  if (err1) console.error(err1);

  const { data: desligado, error: err2 } = await supabase.from('employees').select('id, name, status').eq('status', 'Desligado');
  console.log('Desligado count:', desligado ? desligado.length : 0);
  if (err2) console.error(err2);

  if (deadArchive && deadArchive.length > 0) {
    console.log('Deleting Arquivo Morto...');
    const { error: err3 } = await supabase.from('employees').delete().eq('status', 'Arquivo Morto');
    if (err3) console.error(err3);
    else console.log('Deleted successfully.');
  } else {
    console.log('Nothing to delete in Arquivo Morto.');
  }
}
main();
