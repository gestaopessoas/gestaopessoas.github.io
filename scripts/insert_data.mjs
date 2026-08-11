import fs from 'fs'
import { supabase } from './lib/supabaseClient.mjs'

async function insertData() {
  try {
    const data = JSON.parse(fs.readFileSync('insert_141_employees.json', 'utf8'))
    
    // Clean data to make sure empty strings are null where appropriate to avoid cast errors
    const cleanedData = data.map(d => ({
      ...d,
      admission_date: d.admission_date || null,
      registration_number: d.registration_number || null,
      company_id: d.company_id || null,
      cost_center_id: d.cost_center_id || null
    }))
    
    console.log(`Attempting to insert ${cleanedData.length} records via RPC...`)
    
    const { data: result, error } = await supabase.rpc('insert_employees_temp', { payload: cleanedData })
      
    if (error) {
      console.error('Error inserting data via RPC:', error)
      process.exit(1)
    }
    
    console.log(`Successfully executed RPC for ${cleanedData.length} records!`)
  } catch (err) {
    console.error('Exception:', err)
    process.exit(1)
  }
}

insertData()
