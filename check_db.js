const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync('.env', 'utf8'));

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  console.log("Checking interviews for jusimoesg@hotmail.com");
  const { data: iData } = await supabase.from('interviews').select('id, email, candidate_name, assessment').eq('email', 'jusimoesg@hotmail.com');
  console.log("Interviews eq:", iData ? iData.length : 0);
  if(iData && iData.length > 0) {
    console.log("Has personal_info:", !!iData[0].assessment?.personal_info);
  }

  const { data: iData2 } = await supabase.from('interviews').select('id, email, candidate_name, assessment').ilike('email', 'jusimoesg@hotmail.com');
  console.log("Interviews ilike:", iData2 ? iData2.length : 0);

  const { data: iData3, error } = await supabase.from('interviews').select('id, email, candidate_name, assessment').or(\email.ilike."jusimoesg@hotmail.com",candidate_name.ilike."Juliana Simões Gonsalves"\);
  console.log("Interviews OR quoted:", iData3 ? iData3.length : 0, error);

  const { data: iData4, error: err4 } = await supabase.from('interviews').select('id, email, candidate_name, assessment').or(\email.ilike.jusimoesg@hotmail.com,candidate_name.ilike.Juliana Simões Gonsalves\);
  console.log("Interviews OR unquoted:", iData4 ? iData4.length : 0, err4);
}
check();
