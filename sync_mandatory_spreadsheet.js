const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function normalizeName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "").trim();
}

const BENEFIT_MAPPING = [
  { excelKey: 'Odonto', dbName: 'OdontoPrev' },
  { excelKey: 'Sulclinica', dbName: 'SulClínica' },
  { excelKey: 'VR/Auxilios', dbName: 'Vale Refeição' }
];

async function run() {
  console.log('Starting Hard Sync from Spreadsheet...');
  
  // 1. Fetch System Settings to check pause
  const { data: settings } = await supabase.from('system_settings').select('pause_history_tracking').single();
  const pauseHistory = settings?.pause_history_tracking || false;
  
  // 2. Load Excel Data
  const rawExcelData = fs.readFileSync('C:\\Users\\ACPO Empreendimentos\\.gemini\\antigravity\\brain\\cdabee16-7d60-4be9-9d46-c848215f92a7\\scratch\\excel_data.json', 'utf8').replace(/^\uFEFF/, '');
  const excelData = JSON.parse(rawExcelData);
  
  // 3. Load DB Data
  const { data: employees } = await supabase.from('employees').select('id, name, status');
  const { data: costs } = await supabase.from('employee_costs').select('employee_id, base_salary, variable_pay, role, level, type, start_date');
  const { data: benefits } = await supabase.from('employee_benefits').select('id, employee_id, benefit_name, value, active');
  
  const dbEmpMap = new Map();
  for (const e of employees) {
    const cost = costs.find(c => c.employee_id === e.id) || {};
    const empBenefits = benefits.filter(b => b.employee_id === e.id && b.active !== false);
    dbEmpMap.set(normalizeName(e.name), { ...e, cost, benefits: empBenefits });
  }

  const processedNames = new Set();
  let addedCount = 0;
  let updatedCount = 0;
  let deactivatedCount = 0;
  
  for (const row of excelData) {
    const rawName = row.Nome || row['NOME COMPLETO'];
    if (!rawName || rawName === 'VAZIO' || rawName === 'TOTAL') continue;
    
    const normName = normalizeName(rawName);
    processedNames.add(normName);
    
    const isActiveInExcel = row.ATIVO !== 'INATIVO';
    const excelStatus = row.ATIVO === 'AFASTADO' ? 'Afastado' : (row.ATIVO === 'FERIAS' ? 'Férias' : 'Ativo');
    
    // Default fallback values
    const excelBaseSalary = Number(row.BASE) || 0;
    const excelVariablePay = Number(row['Com/VG']) || 0;
    const excelRole = row.CARGO || 'N/A';
    const excelLevel = row.NÍVEL || null;
    const excelType = row.PJ ? 'PJ' : 'CLT';
    
    let dbEmp = dbEmpMap.get(normName);
    let historyChanges = [];
    
    if (!dbEmp) {
        // Missing in DB entirely - insert!
        if (isActiveInExcel) {
            console.log(`Adding missing employee: ${rawName}`);
            const { data: newEmp, error: insertErr } = await supabase.from('employees')
                .insert({ name: rawName, status: excelStatus, company_id: '15403248-18e9-4e7d-9477-96a929deab65' }) // fallback company
                .select().single();
                
            if (newEmp) {
                await supabase.from('employee_costs').insert({
                    employee_id: newEmp.id,
                    base_salary: excelBaseSalary,
                    variable_pay: excelVariablePay,
                    role: excelRole,
                    level: excelLevel,
                    type: excelType
                });
                
                dbEmp = { id: newEmp.id, name: rawName, status: excelStatus, cost: { base_salary: excelBaseSalary, variable_pay: excelVariablePay, role: excelRole, level: excelLevel, type: excelType }, benefits: [] };
                addedCount++;
                
                if (!pauseHistory) {
                    await supabase.from('employee_history').insert({
                        employee_id: newEmp.id, change_type: 'RECONTRATACAO',
                        new_value: { status: excelStatus }, description: 'Inserido no sistema via Sincronização de Custos.'
                    });
                }
            }
        }
    } else {
        // Exists in DB, check diffs
        let statusChanged = false;
        let costsChanged = false;
        let updateCostsObj = {};
        
        // 1. Check Status
        if (isActiveInExcel && dbEmp.status === 'Desligado') {
            statusChanged = true;
            historyChanges.push({ type: 'RECONTRATACAO', old: { status: dbEmp.status }, new: { status: excelStatus }, desc: 'Colaborador ativado via Planilha.' });
        } else if (!isActiveInExcel && dbEmp.status !== 'Desligado') {
            statusChanged = true;
            historyChanges.push({ type: 'STATUS', old: { status: dbEmp.status }, new: { status: 'Desligado' }, desc: 'Colaborador desligado via Planilha.' });
        } else if (isActiveInExcel && dbEmp.status !== excelStatus && dbEmp.status !== 'Desligado') {
             // Changing from Ativo to Ferias, etc
             statusChanged = true;
             historyChanges.push({ type: 'STATUS', old: { status: dbEmp.status }, new: { status: excelStatus }, desc: 'Status atualizado via Planilha.' });
        }

        const newStatus = !isActiveInExcel ? 'Desligado' : excelStatus;
        if (statusChanged) {
            await supabase.from('employees').update({ status: newStatus }).eq('id', dbEmp.id);
            dbEmp.status = newStatus;
        }

        if (newStatus !== 'Desligado') {
             // 2. Check Financials/Role (Only if active)
             const oldCost = dbEmp.cost || {};
             
             if (oldCost.base_salary !== excelBaseSalary || oldCost.variable_pay !== excelVariablePay) {
                 costsChanged = true;
                 updateCostsObj.base_salary = excelBaseSalary;
                 updateCostsObj.variable_pay = excelVariablePay;
                 historyChanges.push({ type: 'SALARIO', old: { base: oldCost.base_salary, variable: oldCost.variable_pay }, new: { base: excelBaseSalary, variable: excelVariablePay }, desc: 'Atualização salarial.' });
             }
             if (oldCost.role !== excelRole || oldCost.level !== excelLevel) {
                 costsChanged = true;
                 updateCostsObj.role = excelRole;
                 updateCostsObj.level = excelLevel;
                 historyChanges.push({ type: 'CARGO', old: { role: oldCost.role, level: oldCost.level }, new: { role: excelRole, level: excelLevel }, desc: 'Mudança de Cargo/Nível.' });
             }
             if (oldCost.type !== excelType) {
                 costsChanged = true;
                 updateCostsObj.type = excelType;
                 historyChanges.push({ type: 'VINCULO', old: { type: oldCost.type }, new: { type: excelType }, desc: 'Mudança de Vínculo Contratual.' });
             }
             
             if (costsChanged) {
                 if (!oldCost.employee_id) {
                     await supabase.from('employee_costs').insert({ employee_id: dbEmp.id, ...updateCostsObj });
                 } else {
                     await supabase.from('employee_costs').update(updateCostsObj).eq('employee_id', dbEmp.id);
                 }
             }
        }

        if (statusChanged || costsChanged) {
            updatedCount++;
            if (!pauseHistory && historyChanges.length > 0) {
                for (const change of historyChanges) {
                    await supabase.from('employee_history').insert({
                        employee_id: dbEmp.id, change_type: change.type,
                        old_value: change.old, new_value: change.new, description: change.desc
                    });
                }
            }
        }
    }
    
    // 3. Process Benefits (if employee is not deactivated)
    if (dbEmp && dbEmp.status !== 'Desligado') {
        let benefitsChanged = false;
        const currentBenefits = dbEmp.benefits || [];
        const oldBenRecord = {};
        const newBenRecord = {};
        
        for (const mapping of BENEFIT_MAPPING) {
            const excelValue = Number(row[mapping.excelKey]) || 0;
            const existingBen = currentBenefits.find(b => b.benefit_name === mapping.dbName);
            
            oldBenRecord[mapping.dbName] = existingBen ? existingBen.value : 0;
            newBenRecord[mapping.dbName] = excelValue;
            
            if (excelValue > 0) {
                if (!existingBen) {
                    // Create
                    await supabase.from('employee_benefits').insert({ employee_id: dbEmp.id, benefit_name: mapping.dbName, value: excelValue, active: true });
                    benefitsChanged = true;
                } else if (existingBen.value !== excelValue) {
                    // Update
                    await supabase.from('employee_benefits').update({ value: excelValue, active: true }).eq('id', existingBen.id);
                    benefitsChanged = true;
                }
            } else if (existingBen) {
                // Delete / Deactivate
                await supabase.from('employee_benefits').update({ active: false }).eq('id', existingBen.id);
                benefitsChanged = true;
            }
        }
        
        if (benefitsChanged && !pauseHistory) {
            await supabase.from('employee_history').insert({
                 employee_id: dbEmp.id, change_type: 'BENEFICIOS',
                 old_value: oldBenRecord, new_value: newBenRecord, description: 'Atualização de pacote de benefícios.'
            });
        }
    }
  }

  // 4. Deactivate DB Employees not in Excel
  for (const [normName, emp] of dbEmpMap.entries()) {
      if (emp.status !== 'Desligado' && !processedNames.has(normName)) {
          // Employee is active in DB, but missing entirely from Excel
          console.log(`Deactivating employee missing from Excel: ${emp.name}`);
          await supabase.from('employees').update({ status: 'Desligado' }).eq('id', emp.id);
          deactivatedCount++;
          
          if (!pauseHistory) {
              await supabase.from('employee_history').insert({
                 employee_id: emp.id, change_type: 'STATUS',
                 old_value: { status: emp.status }, new_value: { status: 'Desligado' }, description: 'Desligamento automático - removido da planilha financeira.'
              });
          }
      }
  }

  console.log('--- SYNC COMPLETE ---');
  console.log(`Added: ${addedCount}`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Deactivated: ${deactivatedCount}`);
}

run().catch(console.error);
