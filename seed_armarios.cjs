const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bnwwdseczwrmmuvallml.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJud3dkc2VjendybW11dmFsbG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDIxMDcsImV4cCI6MjA5OTAxODEwN30.46hTU6b8xgpsoASZu0K7cEi_FfA3ZBt8e417mfrda7k');

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
