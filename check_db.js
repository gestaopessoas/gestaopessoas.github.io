const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: employees, error } = await supabase.from('employees').select('id, name, registration_number');
    if (error) {
        console.error("Error fetching employees:", error);
        return;
    }
    console.log(`Found ${employees.length} employees in DB.`);
    if (employees.length > 0) {
        console.log("Sample:", employees.slice(0, 3));
    }
}
check();
