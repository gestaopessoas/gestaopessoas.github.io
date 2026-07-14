require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const tables = [
  "departments", "job_profiles", "employees", "job_openings", 
  "job_applications", "time_logs", "islands", "rgs_processes", 
  "occupational_exams", "employee_benefits", "employee_epis", 
  "vacations", "system_settings", "settings", "users", "candidates"
];

async function scan() {
  console.log("Scanning tables for usage...");
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`- ${table}: ERROR (${error.message})`);
    } else {
      console.log(`- ${table}: ${count} rows`);
    }
  }
}
scan();
