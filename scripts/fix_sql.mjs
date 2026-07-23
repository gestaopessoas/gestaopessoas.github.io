import fs from 'fs'
const sql = fs.readFileSync('update_cost_centers.sql', 'utf8')
const fixed = sql.replace("INSERT INTO cost_centers (id, name, dominio_code) VALUES ('510ac4b0-9949-46a1-89b1-7b0d98c0141e', 'ASSISTENCIA TECNICA', '519');",
"INSERT INTO cost_centers (id, name, code, dominio_code) VALUES ('510ac4b0-9949-46a1-89b1-7b0d98c0141e', 'ASSISTENCIA TECNICA', '519', '519');")
.replace("INSERT INTO cost_centers (id, name, dominio_code) VALUES ('80283154-7a9f-4022-ac88-5029a5f013b8', 'ACPO COTIZA SPE', '879');",
"INSERT INTO cost_centers (id, name, code, dominio_code) VALUES ('80283154-7a9f-4022-ac88-5029a5f013b8', 'ACPO COTIZA SPE', '879', '879');")
fs.writeFileSync('update_cost_centers_fixed.sql', fixed)
