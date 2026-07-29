import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://bnwwdseczwrmmuvallml.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJud3dkc2VjendybW11dmFsbG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDIxMDcsImV4cCI6MjA5OTAxODEwN30.46hTU6b8xgpsoASZu0K7cEi_FfA3ZBt8e417mfrda7k";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

async function test() {
  const { count: c1 } = await supabase.from("employees").select("*", { count: 'exact', head: true });
  const { count: c2 } = await supabase.from("job_requests").select("*", { count: 'exact', head: true });
  console.log("Employees Count:", c1);
  console.log("Requests Count:", c2);
}

test();
