const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('http://localhost:54321', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy'); // just to check syntax builder
const query = supabase.from('interviews').select('*').or(\email.ilike.a@b.com,candidate_name.ilike.John Doe\);
console.log(query.url.toString());
