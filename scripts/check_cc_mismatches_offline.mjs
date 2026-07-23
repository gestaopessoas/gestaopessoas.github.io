import fs from 'fs'

// A function to normalize names
function normalizeStr(s) {
    if (!s) return ""
    return s.toString().trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

async function run() {
    // 2. Get cost centers and companies from backup
    const dbData = JSON.parse(fs.readFileSync('C:\\Users\\ACPO Empreendimentos\\Desktop\\Nova pasta (2)\\backup_gestaopessoas_2026-07-21.json', 'utf8'))
    const dbCompanies = dbData.companies || []
    const dbCostCenters = dbData.cost_centers || []

    const compMap = {}
    dbCompanies.forEach(c => compMap[c.id] = c.name)
    const ccMap = {}
    dbCostCenters.forEach(cc => ccMap[cc.id] = cc.name)

    // 1. Get employees from backup + the newly inserted ones
    const dbEmployees = dbData.employees || []
    const insertedEmployees = JSON.parse(fs.readFileSync('insert_141_employees.json', 'utf8'))
    
    // Combine them
    const allDbEmployees = [...dbEmployees, ...insertedEmployees]

    // 3. Load PDF extracted employees
    const pdfEmployees = JSON.parse(fs.readFileSync('pdf_extracted_employees.json', 'utf8'))

    // 4. Find mismatches
    const mismatches = []
    
    // Create a normalized lookup for DB employees by registration number or name
    const dbEmpMap = {}
    allDbEmployees.forEach(e => {
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
            if (!dbCcName || (!normalizeStr(dbCcName).includes(pdfCcName) && !pdfCcName.includes(normalizeStr(dbCcName)))) {
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
