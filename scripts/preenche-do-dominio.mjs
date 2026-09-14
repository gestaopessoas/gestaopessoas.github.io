// Preenche no sistema o que só existia na planilha "Custos Geral" (export do Domínio).
//
// Roda em simulação por padrão. Só escreve com --aplicar, e sempre grava um backup
// JSON de employees/employee_benefits/sectors em backups/ antes da primeira escrita.
//
//   node scripts/preenche-do-dominio.mjs "<planilha.xlsx>"            # simula
//   node scripts/preenche-do-dominio.mjs "<planilha.xlsx>" --aplicar  # escreve
//
// Regras combinadas com o usuário:
// - Encargos: copia o valor da planilha. A razão encargo/base varia (0,6598 / 0,6500 /
//   0,5998 / 0,20 / 0), então não dá para calcular — a folha é a fonte.
// - Com/VG: a planilha traz comissão e variável garantida somadas. Vai para `commission`
//   quando o cargo é comercial, senão para `variable_salary`. São 15 pessoas, listadas
//   no fim para conferência.
// - VT: valor = 6% do salário base, para quem tem Vale Transporte cadastrado.
// - VR: só preenche quem está sem valor. Para quem tem VT, desconta os 6% do agregado
//   VR/Auxílios da planilha. Quem já tem valor no sistema não é sobrescrito.
// - Só toca em colaborador Ativo ou Afastado que aparece como ATIVO na planilha.
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const ORIGEM = process.argv[2];
const APLICAR = process.argv.includes('--aplicar');
if (!ORIGEM) {
  console.error('Uso: node scripts/preenche-do-dominio.mjs "<planilha.xlsx>" [--aplicar]');
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
const apelido = (s) => {
  const p = norm(s).split(' ').filter((x) => x.length > 2);
  if (!p.length) return '';
  const sem = (x) => x.replace(/[AEIOUH]/g, '');
  return `${sem(p[0])}|${sem(p[p.length - 1])}`;
};
const round2 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- planilha
const wbIn = new ExcelJS.Workbook();
await wbIn.xlsx.readFile(ORIGEM);
const ws = wbIn.getWorksheet('Diretos e Indiretos');
const cel = (v) => (v && typeof v === 'object' ? (v.result ?? v.text ?? '') : (v ?? ''));
const idx = {};
ws.getRow(4).values.slice(1).forEach((h, i) => { const k = norm(cel(h)); if (k) idx[k] = i; });
const num = (v) => { const n = Number(cel(v)); return Number.isFinite(n) ? n : 0; };
const txt = (v) => String(cel(v)).trim();

const planilha = [];
for (let r = 5; r <= ws.rowCount; r++) {
  const v = ws.getRow(r).values.slice(1);
  const nome = txt(v[idx['NOME']]);
  if (!nome) continue;
  planilha.push({
    ativo: txt(v[idx['ATIVO']]).toUpperCase(), cod: txt(v[idx['COD']]), nome,
    cargo: txt(v[idx['CARGO']]), setor: txt(v[idx['SETOR']]), cc: txt(v[idx['CENTRO CUSTO']]),
    base: num(v[idx['BASE']]), alim: num(v[idx['ALIMENTACAO']]), comvg: num(v[idx['COM VG']]),
    seguro: num(v[idx['SEGURO']]), odonto: num(v[idx['ODONTO']]), sul: num(v[idx['SULCLINICA']]),
    vr: num(v[idx['VR AUXILIOS']]), enc: num(v[idx['ENCARGOS']]), vinculo: txt(v[idx['VINCULO']]),
    benef: txt(v[idx['BENEFICIOS']]),
  });
}

// ---------------------------------------------------------------- sistema
const [emps, profiles, beneficios, sectors] = await Promise.all([
  all('employees', 'id,name,role,profile_code,status,registration_number,cost_center,cost_center_id,base_salary,variable_salary,commission,encargos,contract_type,sector_id,department'),
  all('job_profiles', 'profile_code,title,is_operational'),
  all('employee_benefits', 'id,employee_id,benefit_name,value,active'),
  all('sectors', 'id,name'),
]);

const porMatricula = new Map(emps.map((e) => [String(e.registration_number || '').trim(), e]));
const porNome = new Map(emps.map((e) => [norm(e.name), e]));
const porApelido = new Map(emps.map((e) => [apelido(e.name), e]));
const acha = (p) => {
  const cod = /^\d+$/.test(p.cod) ? p.cod : null;
  return (cod && porMatricula.get(cod)) || porNome.get(norm(p.nome)) || porApelido.get(apelido(p.nome)) || null;
};
const porCodigoCargo = new Map(profiles.map((p) => [p.profile_code, p]));
const porTituloCargo = new Map(profiles.map((p) => [norm(p.title), p]));
const ehDireto = (e) => {
  const p = porCodigoCargo.get(e.profile_code) || porTituloCargo.get(norm(e.role));
  return !!p?.is_operational;
};

const usados = new Set();
const alvo = [];
for (const p of planilha) {
  if (p.ativo !== 'ATIVO') continue;
  const e = acha(p);
  if (!e || !(e.status === 'Ativo' || e.status === 'Afastado') || usados.has(e.id)) continue;
  usados.add(e.id);
  alvo.push({ ...p, emp: e });
}

const benefPorEmp = new Map();
beneficios.forEach((b) => {
  if (!benefPorEmp.has(b.employee_id)) benefPorEmp.set(b.employee_id, []);
  benefPorEmp.get(b.employee_id).push(b);
});
const achaBenef = (empId, prefixo) => (benefPorEmp.get(empId) || []).filter((b) => norm(b.benefit_name).startsWith(prefixo));

// ---------------------------------------------------------------- plano
const updEmployees = new Map();   // id -> { campo: valor }
const updBenefits = [];           // { id, value }
const insBenefits = [];           // { employee_id, benefit_name, value, active }
const insSectors = new Set();
const marca = (id, campo, valor) => {
  if (!updEmployees.has(id)) updEmployees.set(id, {});
  updEmployees.get(id)[campo] = valor;
};

// Setores: cria os que a planilha usa e o sistema não tem.
const setorPorNome = new Map(sectors.map((s) => [norm(s.name), s]));
const setoresNovos = new Map();  // norm -> grafia escolhida (a primeira que aparecer)
alvo.forEach((a) => {
  if (!a.setor) return;
  const k = norm(a.setor);
  if (!setorPorNome.has(k) && !setoresNovos.has(k)) setoresNovos.set(k, a.setor);
});
setoresNovos.forEach((nome) => insSectors.add(nome));

// Vínculo: a planilha usa PJ/PRÓ-LABORE/ESTÁGIO; o sistema grava MEI e não tem pró-labore.
const VINCULO = { PJ: 'PJ', CLT: 'CLT', 'PRO LABORE': 'Pró-labore', ESTAGIO: 'Estágio' };

// A coluna BENEFICIOS as vezes diz explicitamente "COMISSAO 0,10%" — quando diz, ela manda.
const comercial = (a) => /COMISS/.test(norm(a.benef))
  || /COMERCIAL|VENDA|PLANTAO|VIABILIZADOR/.test(norm(a.cargo))
  || norm(a.setor) === 'COMERCIAL';
const comvgLista = [];

for (const a of alvo) {
  const e = a.emp;

  // --- campos vazios (não sobrescreve nada preenchido)
  if (!e.encargos && a.enc > 0) marca(e.id, 'encargos', round2(a.enc));
  if (!e.cost_center && a.cc) marca(e.id, 'cost_center', a.cc);
  if (!e.department) marca(e.id, 'department', ehDireto(e) ? 'Direto' : 'Indireto');
  if (!e.sector_id && a.setor) marca(e.id, 'sector_id', { setor: a.setor });  // resolvido depois

  // --- salário base divergente (planilha é a folha, manda)
  if (a.base > 0 && Math.abs(a.base - (Number(e.base_salary) || 0)) > 0.5) {
    marca(e.id, 'base_salary', round2(a.base));
  }

  // --- vínculo
  const alvoVinculo = VINCULO[norm(a.vinculo)];
  if (alvoVinculo && norm(e.contract_type || '') !== norm(alvoVinculo)) {
    marca(e.id, 'contract_type', alvoVinculo);
  }

  // --- comissão x variável garantida
  if (a.comvg > 0) {
    const campo = comercial(a) ? 'commission' : 'variable_salary';
    const atual = Number(e[campo]) || 0;
    if (Math.abs(atual - a.comvg) > 0.5) marca(e.id, campo, round2(a.comvg));
    comvgLista.push({ nome: e.name, cargo: a.cargo, setor: a.setor, valor: a.comvg, campo });
  }

  // --- benefícios com valor
  const rubrica = (prefixo, nomeNovo, valor) => {
    if (!(valor > 0)) return;
    const existentes = achaBenef(e.id, prefixo);
    if (existentes.length) {
      // Quando há mais de uma linha (níveis diferentes), o valor da folha vai na primeira
      // e as demais zeram, para não somar duas vezes.
      existentes.forEach((b, i) => {
        const novo = i === 0 ? round2(valor) : 0;
        if (Number(b.value) !== novo) updBenefits.push({ id: b.id, value: novo, nome: e.name, benef: b.benefit_name });
      });
    } else {
      insBenefits.push({ employee_id: e.id, benefit_name: nomeNovo, value: round2(valor), active: true, _nome: e.name });
    }
  };
  rubrica('SULCLINICA', 'SULCLÍNICA', a.sul);
  rubrica('ODONTOPREV', 'ODONTOPREV', a.odonto);
  rubrica('ALIMENTACAO NA EMPRESA', 'ALIMENTAÇÃO NA EMPRESA', a.alim);
  rubrica('SEGURO DE VIDA', 'SEGURO DE VIDA', a.seguro);

  // --- VT: 6% do salário base, para quem tem o benefício cadastrado
  const vts = achaBenef(e.id, 'VALE TRANSPORTE');
  const valorVT = vts.length ? round2((Number(e.base_salary) || a.base) * 0.06) : 0;
  vts.forEach((b, i) => {
    const novo = i === 0 ? valorVT : 0;
    if (Number(b.value) !== novo) updBenefits.push({ id: b.id, value: novo, nome: e.name, benef: b.benefit_name });
  });

  // --- VR: só quem está sem valor. Desconta o VT do agregado VR/Auxílios.
  const vrs = achaBenef(e.id, 'VALE REFEICAO');
  const jaTemVR = vrs.some((b) => Number(b.value) > 0);
  const vrLimpo = round2(Math.max(a.vr - valorVT, 0));
  if (!jaTemVR && vrLimpo > 0) {
    if (vrs.length) updBenefits.push({ id: vrs[0].id, value: vrLimpo, nome: e.name, benef: vrs[0].benefit_name });
    else insBenefits.push({ employee_id: e.id, benefit_name: 'VALE REFEIÇÃO', value: vrLimpo, active: true, _nome: e.name });
  }
}

// ---------------------------------------------------------------- relatório
const contaCampo = (campo) => [...updEmployees.values()].filter((v) => campo in v).length;
console.log(`\nColaboradores no escopo: ${alvo.length}`);
console.log('\n--- employees ---');
['encargos', 'cost_center', 'department', 'sector_id', 'base_salary', 'contract_type', 'commission', 'variable_salary']
  .forEach((c) => console.log(`  ${c.padEnd(16)} ${contaCampo(c)}`));
console.log(`  linhas a atualizar: ${updEmployees.size}`);
console.log('\n--- sectors ---');
console.log(`  criar: ${insSectors.size}${insSectors.size ? ' -> ' + [...insSectors].join(', ') : ''}`);
console.log('\n--- employee_benefits ---');
const porRubrica = (lista, campo) => {
  const c = {};
  lista.forEach((x) => { const k = norm(x[campo]).replace(/ CARTAO.*/, '').replace(/ NIVEL.*/, ''); c[k] = (c[k] || 0) + 1; });
  return c;
};
console.log('  atualizar:', JSON.stringify(porRubrica(updBenefits, 'benef')));
console.log('  criar:', JSON.stringify(porRubrica(insBenefits, 'benefit_name')));
console.log(`  total: ${updBenefits.length} updates, ${insBenefits.length} inserts`);
console.log('\n--- Com/VG: confira a separação (15 pessoas) ---');
comvgLista.sort((a, b) => b.valor - a.valor).forEach((c) => {
  console.log(`  ${c.campo === 'commission' ? 'COMISSÃO ' : 'VARIÁVEL '} ${c.valor.toFixed(2).padStart(11)} | ${c.setor.padEnd(14)} | ${c.cargo.padEnd(26)} | ${c.nome}`);
});

if (!APLICAR) {
  console.log('\nSIMULAÇÃO. Nada foi escrito. Rode de novo com --aplicar para gravar.');
  process.exit(0);
}

// ---------------------------------------------------------------- backup
const carimbo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dirBackup = path.join('backups', `preenche-dominio-${carimbo}`);
fs.mkdirSync(dirBackup, { recursive: true });
fs.writeFileSync(path.join(dirBackup, 'employees.json'), JSON.stringify(await all('employees', '*'), null, 1));
fs.writeFileSync(path.join(dirBackup, 'employee_benefits.json'), JSON.stringify(await all('employee_benefits', '*'), null, 1));
fs.writeFileSync(path.join(dirBackup, 'sectors.json'), JSON.stringify(sectors, null, 1));
console.log(`\nBackup em ${dirBackup}`);

// ---------------------------------------------------------------- escrita
let erros = 0;
const falhou = (o, error) => { erros++; console.error('  ERRO', JSON.stringify(o), error.message); };

// 1. setores novos
for (const nome of insSectors) {
  const { data, error } = await sb.from('sectors').insert({ name: nome }).select('id,name').single();
  if (error) falhou({ setor: nome }, error);
  else setorPorNome.set(norm(data.name), data);
}

// 2. employees — resolve o sector_id agora que os setores existem
for (const [id, campos] of updEmployees) {
  if (campos.sector_id && typeof campos.sector_id === 'object') {
    const s = setorPorNome.get(norm(campos.sector_id.setor));
    if (s) campos.sector_id = s.id; else delete campos.sector_id;
  }
  if (!Object.keys(campos).length) continue;
  const { error } = await sb.from('employees').update(campos).eq('id', id);
  if (error) falhou({ id, campos }, error);
}

// 3. benefícios
for (const u of updBenefits) {
  const { error } = await sb.from('employee_benefits').update({ value: u.value }).eq('id', u.id);
  if (error) falhou(u, error);
}
for (let i = 0; i < insBenefits.length; i += 200) {
  const lote = insBenefits.slice(i, i + 200).map(({ _nome, ...b }) => b);
  const { error } = await sb.from('employee_benefits').insert(lote);
  if (error) falhou({ lote: i }, error);
}

console.log(`\nPronto. ${erros} erro(s).`);
