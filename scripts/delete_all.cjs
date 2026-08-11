const { supabase } = require('./lib/supabaseClient.cjs');

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
