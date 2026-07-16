const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\ACPO Empreendimentos\\.gemini\\antigravity\\brain\\acf67a37-12be-4432-8903-cb3b5dc303b6\\.system_generated\\steps\\815\\output.txt', 'utf8');
const startMarker = '[';
const startIdx = content.indexOf(startMarker);
const endIdx = content.lastIndexOf(']');
if (startIdx !== -1 && endIdx !== -1) {
  const data = JSON.parse(content.substring(startIdx, endIdx + 1));
  console.log('Total:', data.length);
  
  const statusMap = {
    'in_progress': 'Em análise',
    'canceled': 'Recusada', // treating canceled as recusada for now, or maybe just ignore them
    'finished': 'Aprovada' // actually finished is 'Concluída' in Solides, but in our DB it's Aprovada / Em análise / Recusada
  };

  let sql = "";
  for (const v of data) {
    if (v.status !== 'in_progress') continue; // only open positions

    const title = v.title.replace(/'/g, "''");
    const quantity = v.total_positions || 1;
    
    // We insert them as 'Nova' or 'Em análise' 
    const status = 'Em análise'; 
    const created = v.created_at || new Date().toISOString();
    
    sql += `INSERT INTO job_requests (requester_name, position_title, quantity, status, created_at, urgency, manager_expectations) VALUES ('Integração Solides', '${title}', ${quantity}, '${status}', '${created}', 'Média', 'Importado do Solides HR');\n`;
  }
  
  fs.writeFileSync('scratch/insert_solides_vagas.sql', sql);
  console.log('SQL generated!');
} else {
  console.log('No match found');
}
