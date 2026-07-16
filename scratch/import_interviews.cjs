require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const dirPath = "G:\\Meu Drive\\ACPO\\14\\Entrevistas realizadas";

async function main() {
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.xlsx'));
  
  let totalImported = 0;
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    console.log(`Processing ${file}...`);
    
    try {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const data = xlsx.utils.sheet_to_json(worksheet, { defval: "" });
      
      for (const row of data) {
        // Headers: Cargo, Situação, Candidato, Tel, E-mail, Data, Horário, Entrevista
        const role = String(row["Cargo"] || "").trim();
        const status = String(row["Situação"] || "").trim();
        const candidate_name = String(row["Candidato"] || "").trim();
        
        if (!candidate_name) continue; // Skip empty rows
        
        const phone = String(row["Tel"] || "").trim();
        const email = String(row["E-mail"] || "").trim();
        
        // Handle Excel date (number of days since 1899-12-30)
        let interview_date = null;
        if (row["Data"] && !isNaN(row["Data"])) {
          const dateObj = new Date((row["Data"] - 25569) * 86400 * 1000);
          if (!isNaN(dateObj.getTime())) {
            interview_date = dateObj.toISOString().split('T')[0];
          }
        } else if (typeof row["Data"] === "string" && row["Data"].trim()) {
           // Maybe it's a string like '15/01/2026'
           const parts = row["Data"].trim().split(/[\/\-]/);
           if (parts.length === 3) {
             const [d, m, y] = parts[0].length === 4 ? [parts[2], parts[1], parts[0]] : [parts[0], parts[1], parts[2]];
             interview_date = `${y.length === 2 ? '20'+y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
           }
        }
        
        // Handle Excel time
        let interview_time = String(row["Horário"] || "").trim();
        if (row["Horário"] && !isNaN(row["Horário"]) && row["Horário"] < 1) {
           const totalMinutes = Math.round(row["Horário"] * 24 * 60);
           const hours = Math.floor(totalMinutes / 60);
           const minutes = totalMinutes % 60;
           interview_time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        
        const result = String(row["Entrevista"] || "").trim();
        
        const { error } = await supabase.from("interviews").insert({
          role,
          status,
          candidate_name,
          phone,
          email,
          interview_date,
          interview_time,
          result
        });
        
        if (error) {
          console.error(`Error inserting ${candidate_name}:`, error.message);
        } else {
          totalImported++;
        }
      }
    } catch (err) {
      console.error(`Error reading ${file}:`, err.message);
    }
  }
  
  console.log(`Finished importing ${totalImported} records.`);
}

main();
