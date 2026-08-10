import { createClient } from "@supabase/supabase-js";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { error } = await s.rpc('exec_sql', { sql: `
    ALTER TABLE benefit_ignores ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Enable read access for all users" ON benefit_ignores;
    CREATE POLICY "Enable read access for all users" ON benefit_ignores FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Enable insert for all users" ON benefit_ignores;
    CREATE POLICY "Enable insert for all users" ON benefit_ignores FOR INSERT WITH CHECK (true);
    DROP POLICY IF EXISTS "Enable delete for all users" ON benefit_ignores;
    CREATE POLICY "Enable delete for all users" ON benefit_ignores FOR DELETE USING (true);
  `});
  console.log("SQL executed:", error);
}
run();
