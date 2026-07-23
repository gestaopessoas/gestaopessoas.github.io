import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://bnwwdseczwrmmuvallml.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJud3dkc2VjendybW11dmFsbG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDIxMDcsImV4cCI6MjA5OTAxODEwN30.46hTU6b8xgpsoASZu0K7cEi_FfA3ZBt8e417mfrda7k'
// I'll use raw SQL generation instead of direct supabase client if I don't have the service role key!

function normalizeStr(s) {
    if (!s) return ""
    return s.toString().trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

async function run() {
    const dbData = JSON.parse(fs.readFileSync('C:\\Users\\ACPO Empreendimentos\\Desktop\\Nova pasta (2)\\backup_gestaopessoas_2026-07-21.json', 'utf8'))
    const dbCompanies = dbData.companies || []
    let dbCostCenters = dbData.cost_centers || []

    const ccMap = {}
    dbCostCenters.forEach(cc => ccMap[cc.id] = cc)
    
    // Extracted from PDF:
    const pdfCCs = {
      "CONSTRUTORA MATRIZ": "491",
      "ASSISTENCIA TECNICA": "519",
      "SPE CONNECT DUQUE": "10867",
      "ACPO COTIZA SPE": "879",
      "JOY": "980",
      "HOME CLUB III": "10861",
      "SPE MOOV RESIDENCIAL": "10963",
      "SPE MOOV 2": "987",
      "DIRECT": "967",
      "LIFE RIO GRANDE SPE LTDA": "" // default for life
    }

    // Mapping PDF names to DB names
    const pdfToDbName = {
      "CONSTRUTORA MATRIZ": "CONSTRUTORA MATRIZ",
      "SPE CONNECT DUQUE": "SPE CONNECT DUQUE RESIDENCE LTDA",
      "JOY": "JOY RESIDENCE",
      "HOME CLUB III": "RESERVA HOME CLUB",
      "SPE MOOV RESIDENCIAL": "SPE MOOV RESIDENCIAL LTDA",
      "SPE MOOV 2": "SPE MOOV RESIDENCIAL LTDA 2 ATO",
      "DIRECT": "DIRECT SPE LTDA",
      "LIFE RIO GRANDE SPE LTDA": "LIFE RIO GRANDE SPE LTDA"
    }

    let sql = ""
    
    // Let's create UUIDs for the new ones
    import('crypto').then(crypto => {
        // ASSISTENCIA TECNICA and ACPO COTIZA SPE are missing in DB
        const missing = ["ASSISTENCIA TECNICA", "ACPO COTIZA SPE"]
        
        missing.forEach(name => {
            if (!Object.values(ccMap).some(cc => normalizeStr(cc.name) === normalizeStr(name))) {
                const id = crypto.randomUUID()
                // company for them: ASSISTENCIA TECNICA could be matriz? Let's just create the CC, but wait, cost_centers don't have company_id in DB, it's just id, name, dominio_code! Wait, do they?
                // Let's look at backup: "id", "name", "dominio_code". No company_id.
                sql += `INSERT INTO cost_centers (id, name, dominio_code) VALUES ('${id}', '${name}', '${pdfCCs[name]}');\n`
                pdfToDbName[name] = name
                ccMap[id] = { id, name, dominio_code: pdfCCs[name] }
            }
        })
        
        // UPDATE existing CCs with dominio_code
        for (const [pdfName, dbName] of Object.entries(pdfToDbName)) {
            const code = pdfCCs[pdfName]
            if (code) {
                const existing = Object.values(ccMap).find(cc => normalizeStr(cc.name) === normalizeStr(dbName))
                if (existing) {
                    sql += `UPDATE cost_centers SET dominio_code = '${code}' WHERE id = '${existing.id}';\n`
                    existing.dominio_code = code // update local state
                }
            }
        }
        
        // NOW process mismatches
        const mismatches = JSON.parse(fs.readFileSync('mismatches_cc.json', 'utf8'))
        
        for (const m of mismatches) {
            const pdfName = m.pdf_cc
            const dbName = pdfToDbName[pdfName] || pdfName
            const correctCc = Object.values(ccMap).find(cc => normalizeStr(cc.name) === normalizeStr(dbName))
            
            if (correctCc) {
                sql += `UPDATE employees SET cost_center_id = '${correctCc.id}' WHERE id = '${m.id}';\n`
            } else {
                console.log("Could not find correct CC for mismatch:", m)
            }
        }

        fs.writeFileSync('update_cost_centers.sql', sql)
        console.log("update_cost_centers.sql generated successfully.")
    })
}

run()
