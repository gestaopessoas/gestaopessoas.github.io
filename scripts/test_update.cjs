const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf-8');
let url = '', key = '';
env.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

async function run() {
    console.log('Fetching one employee...');
    const { data: emps } = await supabase.from('employees').select('id, name').limit(1);
    if (!emps || emps.length === 0) return console.log('No employees');
    const emp = emps[0];
    
    console.log('Testing update on dismissed_at...');
    const { error } = await supabase.from('employees').update({ dismissed_at: null }).eq('id', emp.id);
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Success! dismissed_at column exists.');
    }
}
run();
