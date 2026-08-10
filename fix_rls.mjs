import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

// Use a abordagem de Management API do Supabase para aplicar SQL
// O service role key bypassa o RLS, então podemos usar queries diretas

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Extrair o project ref da URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
console.log("Project ref:", projectRef);

const statements = [
  // benefit_ignores policies
  `ALTER TABLE benefit_ignores ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "Enable read access for all users" ON benefit_ignores`,
  `CREATE POLICY "Enable read access for all users" ON benefit_ignores FOR SELECT USING (true)`,
  `DROP POLICY IF EXISTS "Enable insert for all users" ON benefit_ignores`,
  `CREATE POLICY "Enable insert for all users" ON benefit_ignores FOR INSERT WITH CHECK (true)`,
  `DROP POLICY IF EXISTS "Enable delete for all users" ON benefit_ignores`,
  `CREATE POLICY "Enable delete for all users" ON benefit_ignores FOR DELETE USING (true)`,
  // benefit_audit_logs policies
  `ALTER TABLE benefit_audit_logs ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "Enable read access for all users" ON benefit_audit_logs`,
  `CREATE POLICY "Enable read access for all users" ON benefit_audit_logs FOR SELECT USING (true)`,
  `DROP POLICY IF EXISTS "Enable insert for all users" ON benefit_audit_logs`,
  `CREATE POLICY "Enable insert for all users" ON benefit_audit_logs FOR INSERT WITH CHECK (true)`,
  `DROP POLICY IF EXISTS "Enable delete for all users" ON benefit_audit_logs`,
  `CREATE POLICY "Enable delete for all users" ON benefit_audit_logs FOR DELETE USING (true)`,
];

async function runSql(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  return { status: res.status, body: await res.text() };
}

async function main() {
  for (const stmt of statements) {
    const result = await runSql(stmt);
    const ok = result.status >= 200 && result.status < 300;
    console.log(`${ok ? "✅" : "❌"} [${result.status}] ${stmt.slice(0, 60)}...`);
    if (!ok) console.log("   Error:", result.body.slice(0, 200));
  }
  
  // Verify final state
  console.log("\n--- Verificação final ---");
  const check = await runSql(`
    SELECT tablename, policyname, cmd 
    FROM pg_policies 
    WHERE tablename IN ('benefit_ignores', 'benefit_audit_logs')
    ORDER BY tablename, policyname
  `);
  console.log("Policies:", check.body.slice(0, 1000));
}

main().catch(console.error);
