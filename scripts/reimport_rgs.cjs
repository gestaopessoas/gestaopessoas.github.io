const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const FILE_PATH = 'C:/Users/ACPO Empreendimentos/Downloads/Controle RGS.xlsx';
const SHEETS = ['2023', '2024', '2025', '2026'];

function excelDate(serial) {
  if (!serial && serial !== 0) return null;
  if (typeof serial === 'string') {
    const s = serial.trim().replace(/[^0-9/]/g, '');
    const parts = s.split('/');
    if (parts.length === 3 && parts.every((p) => p.length > 0)) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return null;
  }
  if (typeof serial !== 'number') return null;
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return date.toISOString().split('T')[0];
}

function str(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function findCol(headers, keywords) {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').toLowerCase();
    if (keywords.some((k) => h.includes(k))) return i;
  }
  return -1;
}

function run() {
  const wb = xlsx.readFile(FILE_PATH);
  const records = [];

  for (const sheetName of SHEETS) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) { console.warn(`Aba ${sheetName} não encontrada, pulando.`); continue; }
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    const headers = rows[0] || [];

    const col = {
      process_type: findCol(headers, ['processo']),
      process_date: findCol(headers, ['data do processo', 'data']),
      employee_name: findCol(headers, ['nome']),
      role: findCol(headers, ['cargo']),
      contract_type: findCol(headers, ['contrato']),
      location: findCol(headers, ['local']),
      sector: findCol(headers, ['setor']),
      effective_date: findCol(headers, ['vigência', 'vigencia']),
      documentation: findCol(headers, ['documentação', 'documentacao']),
      exam_date: findCol(headers, ['exame']),
      integration: findCol(headers, ['integração', 'integracao']),
      domain_access: findCol(headers, ['domínio', 'dominio']),
      solides: findCol(headers, ['sólides', 'solides']),
      accesses: findCol(headers, ['acessos']),
      esocial_aso: findCol(headers, ['e-social aso', 'esocial aso']),
      esocial_amb: findCol(headers, ['e-social amb', 'esocial amb']),
      sst_status: findCol(headers, ['sst']),
      description: findCol(headers, ['descrição', 'descricao']),
    };

    let count = 0;
    for (const cols of rows.slice(1)) {
      const get = (idx) => (idx >= 0 ? cols[idx] : undefined);
      const employee_name = str(get(col.employee_name));
      const process_type = str(get(col.process_type));
      if (!employee_name || !process_type) continue;

      records.push({
        process_type,
        process_date: excelDate(get(col.process_date)),
        employee_name,
        role: str(get(col.role)),
        contract_type: str(get(col.contract_type)),
        location: str(get(col.location)),
        sector: str(get(col.sector)),
        effective_date: excelDate(get(col.effective_date)),
        documentation: str(get(col.documentation)),
        exam_date: excelDate(get(col.exam_date)),
        integration: str(get(col.integration)),
        domain_access: str(get(col.domain_access)),
        solides: str(get(col.solides)),
        accesses: str(get(col.accesses)),
        esocial_aso: str(get(col.esocial_aso)),
        esocial_amb: str(get(col.esocial_amb)),
        sst_status: str(get(col.sst_status)),
        description: str(get(col.description)),
        status: 'Pendente',
      });
      count++;
    }
    console.log(`Aba ${sheetName}: ${count} registros válidos.`);
  }

  console.log(`Total: ${records.length} registros a importar.`);
  return records;
}

async function main() {
  const records = run();

  console.log('Apagando registros atuais...');
  const { error: delError } = await supabase.from('rgs_processes').delete().not('id', 'is', null);
  if (delError) throw delError;

  console.log('Inserindo novos registros...');
  for (let i = 0; i < records.length; i += 200) {
    const batch = records.slice(i, i + 200);
    const { error } = await supabase.from('rgs_processes').insert(batch);
    if (error) { console.error(`Erro no lote ${i}:`, error.message); process.exitCode = 1; }
    else console.log(`Lote ${i + 1}-${i + batch.length} inserido.`);
  }
  console.log('Importação finalizada.');
}

main().catch((e) => { console.error(e); process.exit(1); });
