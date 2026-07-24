import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data: employees, error: err1 } = await supabase.from('employees').select('*').limit(1);
  const { data: history, error: err2 } = await supabase.from('employee_history').select('*').limit(1);
  
  if (err1) console.error(err1);
  if (err2) console.error(err2);

  console.log("Employees columns:", employees && employees.length > 0 ? Object.keys(employees[0]) : "Empty/No access");
  console.log("History columns:", history && history.length > 0 ? Object.keys(history[0]) : "Empty/No access");
}

checkSchema();
