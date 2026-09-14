// Um colaborador tem a mesma rubrica cadastrada duas ou mais vezes, e o relatório soma
// todas — MAICON BORGES CARDOSO aparecia com R$ 2.130,38 de VR porque tinha
// "VALE REFEIÇÃO - NÍVEL VII" (1016, lançado em 20/07) e "VALE REFEIÇÃO" (1114,38,
// lançado em 23/07). A folha diz 1.143,00.
//
// Mantém a linha mais recente de cada rubrica, com o valor da folha quando ela tem o
// colaborador, e desativa as outras (active = false, não apaga).
//
//   node scripts/corrige-beneficios-duplicados.mjs "<planilha.xlsx>" [--aplicar]
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const ORIGEM = process.argv[2];
const APLICAR = process.argv.includes('--aplicar');
if (!ORIGEM) {
  console.error('Uso: node scripts/corrige-beneficios-duplicados.mjs "<planilha.xlsx>" [--aplicar]');
  process.exit(1);
}

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')])
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const all = async (t, c) => {
  let out = [], from = 0;
  for (;;) {
    const { data, error } = await sb.from(t).select(c).range(from, from + 999);
    if (error) throw new Error(`${t}: ${error.message}`);
    out = out.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return out;
};
const norm = (s) => (s || '').toString().toUpperCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const round2 = (n) => Math.round(n * 100) / 100;

// Folha: VR/Auxílios por matrícula.
const wbIn = new ExcelJS.Workbook();
await wbIn.xlsx.readFile(ORIGEM);
const ws = wbIn.getWorksheet('Diretos e Indiretos');
const cel = (v) => (v && typeof v === 'object' ? (v.result ?? v.text ?? '') : (v ?? ''));
const idx = {};
ws.getRow(4).values.slice(1).forEach((h, i) => { const k = norm(cel(h)); if (k) idx[k] = i; });
const folha = new Map();
for (let r = 5; r <= ws.rowCount; r++) {
  const v = ws.getRow(r).values.slice(1);
  const cod = String(cel(v[idx['COD']])).trim();
  if (String(cel(v[idx['ATIVO']])).toUpperCase() !== 'ATIVO' || !/^\d+$/.test(cod)) continue;
  folha.set(cod, {
    vr: Number(cel(v[idx['VR AUXILIOS']])) || 0,
    alim: Number(cel(v[idx['ALIMENTACAO']])) || 0,
    odonto: Number(cel(v[idx['ODONTO']])) || 0,
    sul: Number(cel(v[idx['SULCLINICA']])) || 0,
  });
}

const [emps, beneficios] = await Promise.all([
  all('employees', 'id,name,registration_number,status,base_salary'),
  all('employee_benefits', 'id,employee_id,benefit_name,value,active,created_at'),
]);
const ativos = new Map(emps.filter((e) => e.status === 'Ativo' || e.status === 'Afastado').map((e) => [e.id, e]));

// Rubricas que o relatório soma. O resto fica como está.
const RUBRICAS = [
  ['VALE REFEICAO', 'vr'], ['VALE TRANSPORTE', null], ['ALIMENTACAO NA EMPRESA', 'alim'],
  ['SULCLINICA', 'sul'], ['ODONTOPREV', 'odonto'], ['SEGURO DE VIDA', null], ['CESTA BASICA', null],
];
const rubricaDe = (nome) => RUBRICAS.find(([p]) => norm(nome).startsWith(p));

const grupos = new Map();
for (const b of beneficios) {
  if (b.active === false || !ativos.has(b.employee_id)) continue;
  const r = rubricaDe(b.benefit_name);
  if (!r) continue;
  const k = `${b.employee_id}||${r[0]}`;
  if (!grupos.has(k)) grupos.set(k, []);
  grupos.get(k).push(b);
}

const desativar = [];
const ajustar = [];
for (const [k, linhas] of grupos) {
  if (linhas.length < 2) continue;
  const [empId, rubrica] = k.split('||');
  const e = ativos.get(empId);
  const campo = RUBRICAS.find(([p]) => p === rubrica)[1];
  const daFolha = campo ? folha.get(String(e.registration_number))?.[campo] : undefined;

  // Fica a mais recente; empate de data resolve pelo maior valor.
  const ordenadas = [...linhas].sort((a, b) =>
    b.created_at.localeCompare(a.created_at) || (Number(b.value) || 0) - (Number(a.value) || 0));
  const [manter, ...resto] = ordenadas;

  // Vale Transporte segue a regra dos 6% do salário base; as outras seguem a folha.
  const alvo = rubrica === 'VALE TRANSPORTE'
    ? round2((Number(e.base_salary) || 0) * 0.06)
    : (daFolha > 0 ? round2(daFolha) : Number(manter.value) || 0);

  if (Number(manter.value) !== alvo) {
    ajustar.push({ id: manter.id, value: alvo, nome: e.name, rubrica, de: Number(manter.value) || 0 });
  }
  resto.forEach((b) => desativar.push({ id: b.id, nome: e.name, benefit_name: b.benefit_name, value: b.value }));
}

console.log(`grupos duplicados: ${[...grupos.values()].filter((v) => v.length > 1).length}`);
console.log(`  linhas a desativar: ${desativar.length}`);
console.log(`  valores a ajustar: ${ajustar.length}\n`);
ajustar.forEach((a) => console.log(`  ${a.nome} | ${a.rubrica} | ${a.de.toFixed(2)} -> ${a.value.toFixed(2)}`));
console.log('');
desativar.forEach((d) => console.log(`  desativa | ${d.nome} | ${d.benefit_name} | ${d.value}`));

if (!APLICAR) {
  console.log('\nSIMULAÇÃO. Nada foi escrito. Rode com --aplicar para gravar.');
  process.exit(0);
}

const carimbo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = path.join('backups', `corrige-duplicados-${carimbo}`);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'employee_benefits.json'), JSON.stringify(beneficios, null, 1));
console.log(`\nBackup em ${dir}`);

let erros = 0;
for (const a of ajustar) {
  const { error } = await sb.from('employee_benefits').update({ value: a.value }).eq('id', a.id);
  if (error) { erros++; console.error('  ERRO ajuste', a.nome, error.message); }
}
for (let i = 0; i < desativar.length; i += 100) {
  const ids = desativar.slice(i, i + 100).map((d) => d.id);
  const { error } = await sb.from('employee_benefits').update({ active: false }).in('id', ids);
  if (error) { erros++; console.error('  ERRO desativar lote', i, error.message); }
}
console.log(`\nPronto. ${erros} erro(s).`);
