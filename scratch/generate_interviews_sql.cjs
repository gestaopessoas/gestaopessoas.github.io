const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");

const dirPath = "G:\\Meu Drive\\ACPO\\14\\Entrevistas realizadas";
const outFile = "c:\\Users\\ACPO Empreendimentos\\Documents\\Github\\gestaopessoas.github.io\\scratch\\insert_interviews.sql";

function escapeSql(str) {
  if (str === null || str === undefined) return "NULL";
  return "'" + String(str).replace(/'/g, "''") + "'";
}

async function main() {
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.xlsx'));
  
  let sql = "INSERT INTO public.interviews (role, status, candidate_name, phone, email, interview_date, interview_time, result) VALUES\n";
  let values = [];
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    try {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const data = xlsx.utils.sheet_to_json(worksheet, { defval: "" });
      
      for (const row of data) {
        const role = String(row["Cargo"] || "").trim();
        const status = String(row["Situação"] || "").trim();
        const candidate_name = String(row["Candidato"] || "").trim();
        
        if (!candidate_name) continue;
        
        const phone = String(row["Tel"] || "").trim();
        const email = String(row["E-mail"] || "").trim();
        
        let interview_date = null;
        if (row["Data"] && !isNaN(row["Data"])) {
          const dateObj = new Date((row["Data"] - 25569) * 86400 * 1000);
          if (!isNaN(dateObj.getTime())) {
            interview_date = dateObj.toISOString().split('T')[0];
          }
        } else if (typeof row["Data"] === "string" && row["Data"].trim()) {
           const parts = row["Data"].trim().split(/[\/\-]/);
           if (parts.length === 3) {
             const [d, m, y] = parts[0].length === 4 ? [parts[2], parts[1], parts[0]] : [parts[0], parts[1], parts[2]];
             interview_date = `${y.length === 2 ? '20'+y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
           }
        }
        
        let interview_time = String(row["Horário"] || "").trim();
        if (row["Horário"] && !isNaN(row["Horário"]) && row["Horário"] < 1) {
           const totalMinutes = Math.round(row["Horário"] * 24 * 60);
           const hours = Math.floor(totalMinutes / 60);
           const minutes = totalMinutes % 60;
           interview_time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        
        const result = String(row["Entrevista"] || "").trim();
        
        values.push(`(${escapeSql(role)}, ${escapeSql(status)}, ${escapeSql(candidate_name)}, ${escapeSql(phone)}, ${escapeSql(email)}, ${interview_date ? escapeSql(interview_date) : "NULL"}, ${escapeSql(interview_time)}, ${escapeSql(result)})`);
      }
    } catch (err) {
      console.error(`Error reading ${file}:`, err.message);
    }
  }
  
  sql += values.join(",\n") + ";\n";
  fs.writeFileSync(outFile, sql);
  console.log(`Wrote ${values.length} rows to ${outFile}`);
}

main();
