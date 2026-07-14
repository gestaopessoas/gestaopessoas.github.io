const { createClient } = require('@supabase/supabase-js');
const { differenceInDays, isValid, parseISO } = require('date-fns');

// Use the local env vars
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data } = await supabase
    .from("employees")
    .select("id, name, admission_date, contract_type, status")
    .in("name", ["Andrei Carvalho Aquino", "Thais Shaillene Costa"]);
    
  console.log("Raw DB records:", data);
  
  const today = new Date();
  
  for (const emp of data) {
    console.log(`\n--- ${emp.name} ---`);
    console.log(`Admission Date: ${emp.admission_date}`);
    if (!emp.admission_date) {
      console.log("NO DATE");
      continue;
    }
    const admission = parseISO(emp.admission_date);
    console.log(`Parsed ISO valid? ${isValid(admission)}, object: ${admission}`);
    
    if (!isValid(admission)) continue;
    
    const daysElapsed = differenceInDays(today, admission);
    const daysRemaining = 90 - daysElapsed;
    console.log(`Days elapsed: ${daysElapsed}, remaining: ${daysRemaining}`);
  }
}

test();
