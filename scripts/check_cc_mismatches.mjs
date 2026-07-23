import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://bnwwdseczwrmmuvallml.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJud3dkc2VjendybW11dmFsbG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDIxMDcsImV4cCI6MjA5OTAxODEwN30.46hTU6b8xgpsoASZu0K7cEi_FfA3ZBt8e417mfrda7k'
const supabase = createClient(supabaseUrl, supabaseKey)

// A function to normalize names
function normalizeStr(s) {
    if (!s) return ""
    return s.toString().trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

async function run() {
    // 1. Get all employees from DB
    // I need to use the MCP execute_sql if RLS prevents reading?
    // Let's test if we can read employees
    const { data: dbEmployees, error } = await supabase.from('employees').select('id, name, registration_number, company_id, cost_center_id')
    if (error) {
        console.error("Error reading employees:", error)
        // Fallback to reading the local backup + insert json
        process.exit(1)
    }

    // 2. Get cost centers and companies
    const { data: dbCompanies } = await supabase.from('companies').select('id, name')
    const { data: dbCostCenters } = await supabase.from('cost_centers').select('id, name')

    const compMap = {}
    dbCompanies.forEach(c => compMap[c.id] = c.name)
    const ccMap = {}
    dbCostCenters.forEach(cc => ccMap[cc.id] = cc.name)

    // 3. Load PDF extracted employees
    const pdfEmployees = JSON.parse(fs.readFileSync('pdf_extracted_employees.json', 'utf8'))

    // 4. Find mismatches
    const mismatches = []
    
    // Create a normalized lookup for DB employees by registration number or name
    const dbEmpMap = {}
    dbEmployees.forEach(e => {
        dbEmpMap[normalizeStr(e.name)] = e
        if (e.registration_number) {
            dbEmpMap[e.registration_number.toString()] = e
        }
    })

    pdfEmployees.forEach(pe => {
        const normName = normalizeStr(pe.name)
        let dbE = dbEmpMap[pe.matricula] || dbEmpMap[normName]
        
        if (dbE) {
            const dbCcName = ccMap[dbE.cost_center_id]
            const pdfCcName = normalizeStr(pe.cost_center)
            
            // simple match logic
            // Because names in PDF like "SPE CONNECT DUQUE" might match DB "SPE CONNECT DUQUE RESIDENCE LTDA"
            if (!dbCcName || !normalizeStr(dbCcName).includes(pdfCcName) && !pdfCcName.includes(normalizeStr(dbCcName))) {
                // If they don't match, record it
                // Except cases where PDF says "ACPO COTIZA SPE" and DB says something else
                mismatches.push({
                    id: dbE.id,
                    name: dbE.name,
                    matricula: dbE.registration_number,
                    pdf_cc: pe.cost_center,
                    pdf_dominio_code: pe.cc_dominio_code,
                    db_cc: dbCcName,
                    db_cc_id: dbE.cost_center_id
                })
            }
        }
    })

    fs.writeFileSync('mismatches_cc.json', JSON.stringify(mismatches, null, 2))
    console.log(`Found ${mismatches.length} potential mismatches.`)
}

run()
