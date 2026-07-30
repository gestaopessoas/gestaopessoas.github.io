require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearInterviews() {
  console.log("Fetching interviews...");
  const { data, error } = await supabase.from('interviews').select('id');
  if (error) {
    console.error("Error fetching interviews:", error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log("No interviews found.");
    return;
  }

  console.log(`Found ${data.length} interviews. Deleting...`);
  
  // Try bulk delete using neq
  const { error: delError } = await supabase.from('interviews').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (delError) {
    console.error("Error doing bulk delete, trying one by one:", delError);
    // If RLS prevents bulk delete without specific id match, we do it one by one
    let count = 0;
    for (const item of data) {
      const { error: delErr } = await supabase.from('interviews').delete().eq('id', item.id);
      if (delErr) {
        console.error(`Error deleting ${item.id}:`, delErr);
      } else {
        count++;
      }
    }
    console.log(`Deleted ${count} interviews one by one.`);
  } else {
    console.log("Successfully bulk deleted interviews.");
  }
}

clearInterviews();
