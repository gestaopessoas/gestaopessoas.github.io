const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bnwwdseczwrmmuvallml.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJud3dkc2VjendybW11dmFsbG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDIxMDcsImV4cCI6MjA5OTAxODEwN30.46hTU6b8xgpsoASZu0K7cEi_FfA3ZBt8e417mfrda7k');

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
