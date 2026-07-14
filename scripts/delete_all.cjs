const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bnwwdseczwrmmuvallml.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJud3dkc2VjendybW11dmFsbG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDIxMDcsImV4cCI6MjA5OTAxODEwN30.46hTU6b8xgpsoASZu0K7cEi_FfA3ZBt8e417mfrda7k');

async function main() {
  console.log('Deletando todos os colaboradores...');
  
  // To bypass any Supabase limits on bulk delete without where clause, 
  // it's sometimes safer to delete in batches or use a condition that is always true like .neq('id', '00000000-0000-0000-0000-000000000000')
  const { error } = await supabase.from('employees').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (error) {
    console.error('Erro ao deletar:', error);
  } else {
    console.log('Todos os colaboradores foram deletados com sucesso.');
  }
}
main();
