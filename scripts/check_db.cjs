const { supabase } = require('./lib/supabaseClient.cjs');

async function main() {
  const { data, count, error } = await supabase
    .from('employees')
    .select('archive_box', { count: 'exact' })
    .eq('status', 'Arquivo Morto')
    .limit(1);

  console.log('Total records in DB:', count);

  const { data: allBoxes } = await supabase
    .from('employees')
    .select('archive_box')
    .eq('status', 'Arquivo Morto')
    .limit(10000);
    
  console.log('Returned rows with limit 10000:', allBoxes ? allBoxes.length : 0);

  // Group to see the last box
  if (allBoxes) {
      const boxes = [...new Set(allBoxes.map(b => b.archive_box))].sort();
      console.log('Total unique boxes:', boxes.length);
      console.log('First 5:', boxes.slice(0, 5));
      console.log('Last 5:', boxes.slice(-5));
  }
}
main();
