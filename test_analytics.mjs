import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://bnwwdseczwrmmuvallml.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJud3dkc2VjendybW11dmFsbG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDIxMDcsImV4cCI6MjA5OTAxODEwN30.46hTU6b8xgpsoASZu0K7cEi_FfA3ZBt8e417mfrda7k";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

async function test() {
  const [employeeResult, requestResult, candidateResult, applicationResult, openingResult] = await Promise.all([
    supabase.from("employees").select("id,status,unit,cost_center").limit(1),
    supabase.from("job_requests").select("id,status,urgency,created_at").limit(1),
    supabase.from("candidates").select("id,created_at,role_interest").limit(1),
    supabase.from("job_applications").select("id,status,created_at").limit(1),
    supabase.from("job_openings").select("id,status").limit(1),
  ]);

  console.log("Employees Error:", employeeResult.error?.message);
  console.log("Requests Error:", requestResult.error?.message);
  console.log("Candidates Error:", candidateResult.error?.message);
  console.log("Applications Error:", applicationResult.error?.message);
  console.log("Openings Error:", openingResult.error?.message);
}

test();
