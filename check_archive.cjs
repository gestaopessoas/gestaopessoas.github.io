const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bnwwdseczwrmmuvallml.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJud3dkc2VjendybW11dmFsbG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDIxMDcsImV4cCI6MjA5OTAxODEwN30.46hTU6b8xgpsoASZu0K7cEi_FfA3ZBt8e417mfrda7k');

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
