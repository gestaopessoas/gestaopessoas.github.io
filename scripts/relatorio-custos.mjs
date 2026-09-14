// Relatório de custo de pessoal, direto do sistema.
//
// Antes os valores vinham da planilha do Domínio porque o sistema não guardava
// comissão, variável garantida, seguro de vida, alimentação nem vale transporte.
// Depois do preenchimento (scripts/preenche-do-dominio.mjs) o banco é a fonte.
//
// Direto/Indireto sai de employees.department; quem estiver sem, cai na regra do
// cargo (job_profiles.is_operational), a mesma que o cadastro de colaboradores usa.
//
//   node scripts/relatorio-custos.mjs [saida.xlsx]
import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const DESTINO = process.argv[2] || path.join('scratch', 'custo-pessoal.xlsx');

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

const [emps, profiles, beneficios, centers, sectors] = await Promise.all([
  all('employees', 'id,name,role,profile_code,status,registration_number,cost_center,cost_center_id,base_salary,variable_salary,commission,encargos,contract_type,sector_id,department'),
  all('job_profiles', 'profile_code,title,is_operational'),
  all('employee_benefits', 'employee_id,benefit_name,value,active'),
  all('cost_centers', 'id,name'),
  all('sectors', 'id,name'),
]);

const porCodigoCargo = new Map(profiles.map((p) => [p.profile_code, p]));
const porTituloCargo = new Map(profiles.map((p) => [norm(p.title), p]));
const centroPorId = new Map(centers.map((c) => [c.id, c.name]));
const setorPorId = new Map(sectors.map((s) => [s.id, s.name]));

// Rubricas do relatório, casadas pelo começo do nome do benefício (os nomes reais
// trazem sufixo de nível ou de cartão: "VALE REFEIÇÃO - NÍVEL II", "FARMÁCIA - CARTÃO 12").
const RUBRICAS = [
  ['alim', 'ALIMENTACAO NA EMPRESA', 'Alimentação na Empresa'],
  ['vr', 'VALE REFEICAO', 'Vale Refeição'],
  ['vt', 'VALE TRANSPORTE', 'Vale Transporte'],
  ['seguro', 'SEGURO DE VIDA', 'Seguro de Vida'],
  ['odonto', 'ODONTOPREV', 'Odonto'],
  ['sul', 'SULCLINICA', 'SulClínica'],
];
const porEmpregado = new Map();
for (const b of beneficios) {
  if (b.active === false) continue;
  const nome = norm(b.benefit_name);
  const rubrica = RUBRICAS.find(([, prefixo]) => nome.startsWith(prefixo));
  if (!rubrica) continue;
  const atual = porEmpregado.get(b.employee_id) || {};
  atual[rubrica[0]] = (atual[rubrica[0]] || 0) + (Number(b.value) || 0);
  porEmpregado.set(b.employee_id, atual);
}

const linhas = emps
  .filter((e) => e.status === 'Ativo' || e.status === 'Afastado')
  .map((e) => {
    const b = porEmpregado.get(e.id) || {};
    const perfil = porCodigoCargo.get(e.profile_code) || porTituloCargo.get(norm(e.role));
    return {
      matricula: e.registration_number || '',
      nome: e.name,
      cargo: e.role || '',
      classificacao: e.department || (perfil?.is_operational ? 'Direto' : 'Indireto'),
      centro: e.cost_center || centroPorId.get(e.cost_center_id) || 'SEM CENTRO DE CUSTO',
      setor: setorPorId.get(e.sector_id) || '',
      vinculo: e.contract_type || '',
      base: Number(e.base_salary) || 0,
      comissao: Number(e.commission) || 0,
      variavel: Number(e.variable_salary) || 0,
      alim: b.alim || 0,
      vr: b.vr || 0,
      vt: b.vt || 0,
      seguro: b.seguro || 0,
      odonto: b.odonto || 0,
      sul: b.sul || 0,
      encargos: Number(e.encargos) || 0,
    };
  })
  .sort((a, b) => a.centro.localeCompare(b.centro) || a.classificacao.localeCompare(b.classificacao) || a.nome.localeCompare(b.nome));

const wb = new ExcelJS.Workbook();
wb.creator = 'Gestão de Pessoas ACPO';
wb.created = new Date();
const MOEDA = '#,##0.00';
const cabecalho = (sheet, larguras) => {
  const r = sheet.getRow(1);
  r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
  r.alignment = { vertical: 'middle', wrapText: true };
  r.height = 32;
  sheet.columns.forEach((c, i) => { c.width = larguras[i]; });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
};

// --- Geral --------------------------------------------------------------------
// Colunas de dinheiro: H..P (base, comissão, variável, alimentação, VR, VT, seguro,
// odonto, sulclínica). Q = custo sem encargos, R = encargos, S = total.
const ger = wb.addWorksheet('Geral');
ger.columns = [
  { header: 'Matrícula', key: 'matricula' }, { header: 'Colaborador', key: 'nome' },
  { header: 'Cargo', key: 'cargo' }, { header: 'Classificação', key: 'classificacao' },
  { header: 'Centro de Custo', key: 'centro' }, { header: 'Setor', key: 'setor' },
  { header: 'Vínculo', key: 'vinculo' }, { header: 'Salário Base', key: 'base' },
  { header: 'Comissão', key: 'comissao' }, { header: 'Variável Garantida', key: 'variavel' },
  { header: 'Alimentação na Empresa', key: 'alim' }, { header: 'Vale Refeição', key: 'vr' },
  { header: 'Vale Transporte', key: 'vt' }, { header: 'Seguro de Vida', key: 'seguro' },
  { header: 'Odonto', key: 'odonto' }, { header: 'SulClínica', key: 'sul' },
  { header: 'Custo sem Encargos', key: 'sem' }, { header: 'Encargos', key: 'encargos' },
  { header: 'Custo Total', key: 'total' },
];
linhas.forEach((l, i) => {
  const r = i + 2;
  ger.addRow({ ...l, sem: { formula: `SUM(H${r}:P${r})` }, total: { formula: `Q${r}+R${r}` } });
});
const fim = linhas.length + 2;
ger.addRow({ nome: 'TOTAL GERAL' });
const DINHEIRO = 'HIJKLMNOPQRS'.split('');
DINHEIRO.forEach((c) => {
  ger.getCell(`${c}${fim}`).value = { formula: `SUM(${c}2:${c}${fim - 1})` };
  ger.getColumn(c).numFmt = MOEDA;
});
ger.getRow(fim).font = { bold: true };
cabecalho(ger, [11, 34, 30, 13, 20, 20, 12, 14, 13, 16, 18, 14, 14, 13, 11, 12, 16, 14, 16]);
ger.autoFilter = { from: 'A1', to: `S${fim - 1}` };

// --- Resumo Geral -------------------------------------------------------------
const RESUMO = [
  ['Salário Base', 'H'], ['Comissão', 'I'], ['Variável Garantida', 'J'],
  ['Alimentação na Empresa', 'K'], ['Vale Refeição', 'L'], ['Vale Transporte', 'M'],
  ['Seguro de Vida', 'N'], ['Odonto', 'O'], ['SulClínica', 'P'], ['Encargos', 'R'],
];
const res = wb.addWorksheet('Resumo Geral');
res.columns = [{ header: 'Rubrica', key: 'r' }, { header: 'Custo Mensal (R$)', key: 'v' }, { header: '% do Total', key: 'p' }];
const linhaTotalResumo = RESUMO.length + 2;
RESUMO.forEach(([nome, col], i) => {
  const r = i + 2;
  res.addRow({ r: nome, v: { formula: `Geral!${col}${fim}` }, p: { formula: `IFERROR(B${r}/$B$${linhaTotalResumo},0)` } });
});
res.addRow({ r: 'CUSTO TOTAL', v: { formula: `SUM(B2:B${linhaTotalResumo - 1})` }, p: { formula: `IFERROR(B${linhaTotalResumo}/$B$${linhaTotalResumo},0)` } });
res.getRow(linhaTotalResumo).font = { bold: true };
res.addRow({});
res.addRow({ r: 'Colaboradores', v: linhas.length });
res.addRow({ r: 'Diretos', v: linhas.filter((l) => l.classificacao === 'Direto').length });
res.addRow({ r: 'Indiretos', v: linhas.filter((l) => l.classificacao === 'Indireto').length });
res.getColumn('v').numFmt = MOEDA;
res.getColumn('p').numFmt = '0.0%';
cabecalho(res, [30, 22, 14]);

// --- Agregados ----------------------------------------------------------------
const COLUNAS_AGREGADO = [
  { header: 'Colaboradores', key: 'qtd' }, { header: 'Salário Base', key: 'base' },
  { header: 'Comissão', key: 'comissao' }, { header: 'Variável Garantida', key: 'variavel' },
  { header: 'Alimentação na Empresa', key: 'alim' }, { header: 'Vale Refeição', key: 'vr' },
  { header: 'Vale Transporte', key: 'vt' }, { header: 'Seguro de Vida', key: 'seguro' },
  { header: 'Odonto', key: 'odonto' }, { header: 'SulClínica', key: 'sul' },
  { header: 'Encargos', key: 'encargos' }, { header: 'Custo Total', key: 'total' },
];
const somasPorCriterio = (crit) => ({
  qtd: { formula: `COUNTIFS(${crit})` },
  ...Object.fromEntries(
    [['base', 'H'], ['comissao', 'I'], ['variavel', 'J'], ['alim', 'K'], ['vr', 'L'],
     ['vt', 'M'], ['seguro', 'N'], ['odonto', 'O'], ['sul', 'P'], ['encargos', 'R']]
      .map(([k, col]) => [k, { formula: `SUMIFS(Geral!$${col}$2:$${col}$${fim - 1},${crit})` }])
  ),
});

const cc = wb.addWorksheet('Direto x Indireto por CC');
cc.columns = [{ header: 'Centro de Custo', key: 'centro' }, { header: 'Classificação', key: 'classificacao' }, ...COLUNAS_AGREGADO];
const chaves = [...new Set(linhas.map((l) => `${l.centro}||${l.classificacao}`))].sort();
chaves.forEach((k, i) => {
  const [centro, classe] = k.split('||');
  const r = i + 2;
  const crit = `Geral!$E$2:$E$${fim - 1},$A${r},Geral!$D$2:$D$${fim - 1},$B${r}`;
  cc.addRow({ centro, classificacao: classe, ...somasPorCriterio(crit), total: { formula: `SUM(D${r}:M${r})` } });
});
const fimCC = chaves.length + 2;
cc.addRow({ centro: 'TOTAL' });
'CDEFGHIJKLMN'.split('').forEach((c) => {
  cc.getCell(`${c}${fimCC}`).value = { formula: `SUM(${c}2:${c}${fimCC - 1})` };
  if (c !== 'C') cc.getColumn(c).numFmt = MOEDA;
});
cc.getRow(fimCC).font = { bold: true };
cabecalho(cc, [24, 13, 13, 14, 13, 16, 18, 14, 14, 13, 11, 12, 14, 16]);
cc.autoFilter = { from: 'A1', to: `N${fimCC - 1}` };

const tot = wb.addWorksheet('Consolidado D x I');
tot.columns = [{ header: 'Classificação', key: 'centro' }, ...COLUNAS_AGREGADO];
['Direto', 'Indireto'].forEach((classe, i) => {
  const r = i + 2;
  const crit = `Geral!$D$2:$D$${fim - 1},$A${r}`;
  tot.addRow({ centro: classe, ...somasPorCriterio(crit), total: { formula: `SUM(C${r}:L${r})` } });
});
tot.addRow({ centro: 'TOTAL' });
'BCDEFGHIJKLM'.split('').forEach((c) => {
  tot.getCell(`${c}4`).value = { formula: `SUM(${c}2:${c}3)` };
  if (c !== 'B') tot.getColumn(c).numFmt = MOEDA;
});
tot.getRow(4).font = { bold: true };
cabecalho(tot, [16, 13, 14, 13, 16, 18, 14, 14, 13, 11, 12, 14, 16]);

const setor = wb.addWorksheet('Por Setor');
setor.columns = [{ header: 'Setor', key: 'centro' }, ...COLUNAS_AGREGADO];
const setores = [...new Set(linhas.map((l) => l.setor || '(sem setor)'))].sort();
setores.forEach((s, i) => {
  const r = i + 2;
  const crit = `Geral!$F$2:$F$${fim - 1},$A${r}`;
  setor.addRow({ centro: s, ...somasPorCriterio(crit), total: { formula: `SUM(C${r}:L${r})` } });
});
const fimSetor = setores.length + 2;
setor.addRow({ centro: 'TOTAL' });
'BCDEFGHIJKLM'.split('').forEach((c) => {
  setor.getCell(`${c}${fimSetor}`).value = { formula: `SUM(${c}2:${c}${fimSetor - 1})` };
  if (c !== 'B') setor.getColumn(c).numFmt = MOEDA;
});
setor.getRow(fimSetor).font = { bold: true };
cabecalho(setor, [22, 13, 14, 13, 16, 18, 14, 14, 13, 11, 12, 14, 16]);
setor.autoFilter = { from: 'A1', to: `M${fimSetor - 1}` };

fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
await wb.xlsx.writeFile(DESTINO);
const soma = (k) => linhas.reduce((s, l) => s + l[k], 0);
console.log(`OK: ${DESTINO}`);
console.log(`  ${linhas.length} colaboradores | ${chaves.length} combinações CC x classificação | ${setores.length} setores`);
console.log(`  custo total: R$ ${['base', 'comissao', 'variavel', 'alim', 'vr', 'vt', 'seguro', 'odonto', 'sul', 'encargos'].reduce((s, k) => s + soma(k), 0).toFixed(2)}`);
