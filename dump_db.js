const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function dump() {
    const { data: employees, error } = await supabase.from('employees').select('*');
    if (error) {
        console.error("Error fetching employees:", error);
        return;
    }
    fs.writeFileSync('db_employees.json', JSON.stringify(employees, null, 2));
    console.log(`Saved ${employees.length} employees to db_employees.json`);
}
dump();
