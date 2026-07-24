const fs = require("fs");

const supabaseUrl = 'https://bnwwdseczwrmmuvallml.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJud3dkc2VjendybW11dmFsbG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDIxMDcsImV4cCI6MjA5OTAxODEwN30.46hTU6b8xgpsoASZu0K7cEi_FfA3ZBt8e417mfrda7k';

function titleCaseBR(str) {
  if (!str) return str;
  const lowers = ["da", "de", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos"];
  
  // Replace multiple spaces with single space
  str = str.replace(/\s+/g, ' ').trim();
  
  return str.split(" ").map((word, index) => {
    word = word.toLowerCase();
    if (lowers.includes(word) && index !== 0) {
      return word;
    }
    // Handle special cases like D'Ávila or O'Connor
    if (word.includes("'")) {
       return word.split("'").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("'");
    }
    // Handle roman numerals if common, but let's keep it simple
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(" ");
}

async function updateTable(tableName, columnToUpdate) {
  const r = await fetch(`${supabaseUrl}/rest/v1/${tableName}?select=id,${columnToUpdate}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });
  const data = await r.json();
  
  if (!data || data.length === 0) {
    console.log(`No data in ${tableName}`);
    return;
  }
  
  console.log(`Processing ${data.length} records for ${tableName}...`);
  let updatedCount = 0;
  
  for (const row of data) {
    if (!row[columnToUpdate]) continue;
    
    const oldVal = row[columnToUpdate];
    const newVal = titleCaseBR(oldVal);
    
    if (oldVal !== newVal) {
      // Perform update
      const updateRes = await fetch(`${supabaseUrl}/rest/v1/${tableName}?id=eq.${row.id}`, {
        method: "PATCH",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ [columnToUpdate]: newVal })
      });
      if (!updateRes.ok) {
        console.error(`Failed to update ${tableName} ID ${row.id}:`, await updateRes.text());
      } else {
        updatedCount++;
      }
    }
  }
  console.log(`✅ ${tableName}: Updated ${updatedCount} records.`);
}

async function main() {
  await updateTable("employees", "name");
  await updateTable("job_profiles", "title");
  await updateTable("departments", "name");
  await updateTable("companies", "trading_name");
}

main().catch(console.error);
