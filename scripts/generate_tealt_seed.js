function getClassification(percentil) {
  if (percentil <= 5) return 'Inferior';
  if (percentil >= 10 && percentil <= 25) return 'Médio Inferior';
  if (percentil >= 30 && percentil <= 70) return 'Médio';
  if (percentil >= 75 && percentil <= 90) return 'Médio Superior';
  if (percentil === 95) return 'Superior';
  if (percentil >= 99) return 'Muito Superior';
  return 'Médio';
}

const norms = [];

function addNorm(test_name, state, division_type, division_name, percentile, score) {
  norms.push({
    test_name, state, division_type, division_name, percentile, score, classification: getClassification(percentile)
  });
}

// TEALT - PR Geral
const prGeral = [
  [1, 41], [5, 53], [10, 57], [15, 64], [20, 71], [25, 74], [30, 78], [35, 81], [40, 85], [45, 89],
  [50, 94], [55, 99], [60, 102], [65, 106], [70, 110], [75, 116], [80, 120], [85, 124], [90, 124], [95, 126], [99, 128]
];
prGeral.forEach(([p, s]) => addNorm('TEALT', 'PR', 'Geral', 'Geral', p, s));

// TEALT - PR Idade
const prIdadeCols = ['Até 22 anos', '23 a 30', '31 a 37', '38 a 44', '45 ou mais'];
const prIdadeData = [
  [1, 73, 46, 39, 25, -2],
  [5, 77, 49, 47, 42, -2],
  [10, 80, 56, 50, 49, 20],
  [15, 84, 59, 53, 52, 25],
  [20, 88, 66, 57, 57, 42],
  [25, 92, 72, 59, 61, 49],
  [30, 97, 78, 62, 64, 52],
  [35, 100, 80, 66, 69, 57],
  [40, 102, 83, 68, 73, 60],
  [45, 106, 86, 74, 75, 66],
  [50, 108, 93, 78, 80, 69],
  [55, 111, 94, 85, 83, 72],
  [60, 117, 99, 88, 88, 74],
  [65, 119, 101, 95, 92, 77],
  [70, 122, 104, 101, 93, 79],
  [75, 125, 107, 108, 102, 82],
  [80, 126, 112, 112, 109, 86],
  [85, 127, 117, 117, 116, 91],
  [90, 128, 120, 122, 118, 94],
  [95, 128, 125, 124, 126, 102],
  [99, 128, 127, 127, 128, 120],
];
prIdadeData.forEach(row => {
  const p = row[0];
  row.slice(1).forEach((s, i) => addNorm('TEALT', 'PR', 'Faixa Etária', prIdadeCols[i], p, s));
});

// TEALT - PR Escolaridade
const prEscCols = ['Fundamental', 'Médio', 'Superior'];
const prEscData = [
  [1, -33, 4, 18],
  [5, 22, 53, 57],
  [10, 35, 61, 70],
  [15, 46, 69, 80],
  [20, 52, 74, 83],
  [25, 55, 77, 86],
  [30, 57, 81, 89],
  [35, 61, 85, 98],
  [40, 63, 88, 101],
  [45, 68, 93, 104],
  [50, 72, 97, 108],
  [55, 75, 101, 111],
  [60, 77, 105, 115],
  [65, 80, 107, 118],
  [70, 84, 110, 120],
  [75, 87, 114, 122],
  [80, 93, 118, 123],
  [85, 101, 122, 124],
  [90, 106, 125, 125],
  [95, 118, 126, 127],
  [99, 125, 127, 128],
];
prEscData.forEach(row => {
  const p = row[0];
  row.slice(1).forEach((s, i) => addNorm('TEALT', 'PR', 'Escolaridade', prEscCols[i], p, s));
});

// TEALT - SC Idade
const scIdadeCols = prIdadeCols;
const scIdadeData = [
  [1, 13, 8, -118, -119, -123],
  [5, 43, 50, -24, 22, -64],
  [10, 51, 64, 36, 41, 18],
  [15, 64, 71, 48, 49, 37],
  [20, 76, 80, 53, 58, 42],
  [25, 80, 84, 58, 61, 52],
  [30, 84, 88, 62, 64, 56],
  [35, 88, 93, 66, 68, 60],
  [40, 93, 97, 70, 72, 61],
  [45, 97, 99, 74, 78, 65],
  [50, 99, 104, 77, 80, 70],
  [55, 104, 106, 82, 84, 73],
  [60, 106, 110, 84, 87, 75],
  [65, 110, 115, 85, 88, 78],
  [70, 115, 124, 91, 91, 85],
  [75, 124, 126, 93, 97, 89],
  [80, 126, 126, 102, 101, 92],
  [85, 126, 127, 118, 120, 100],
  [90, 127, 128, 122, 122, 102],
  [95, 128, 128, 126, 126, 106],
  [99, 128, 128, 127, 128, 128]
];
scIdadeData.forEach(row => {
  const p = row[0];
  row.slice(1).forEach((s, i) => addNorm('TEALT', 'SC', 'Faixa Etária', scIdadeCols[i], p, s));
});

// TEALT - SC Escolaridade
const scEscData = [
  [1, -120, -9, 54],
  [5, 40, 43, 62],
  [10, 49, 52, 69],
  [15, 53, 64, 79],
  [20, 56, 70, 80],
  [25, 59, 75, 84],
  [30, 62, 79, 85],
  [35, 64, 82, 88],
  [40, 67, 86, 93],
  [45, 70, 92, 96],
  [50, 73, 97, 102],
  [55, 75, 100, 104],
  [60, 79, 104, 107],
  [65, 83, 106, 112],
  [70, 88, 114, 116],
  [75, 92, 118, 120],
  [80, 102, 124, 124],
  [85, 116, 125, 125],
  [90, 126, 126, 126],
  [95, 128, 127, 127],
  [99, 128, 128, 128]
];
scEscData.forEach(row => {
  const p = row[0];
  row.slice(1).forEach((s, i) => addNorm('TEALT', 'SC', 'Escolaridade', prEscCols[i], p, s));
});

// TEALT - SP Geral
const spGeral = [
  [1, -27], [5, 40], [10, 51], [15, 58], [20, 64], [25, 70], [30, 74], [35, 78], [40, 80], [45, 84],
  [50, 88], [55, 91], [60, 97], [65, 100], [70, 103], [75, 107], [80, 112], [85, 119], [90, 123], [95, 126], [99, 128]
];
spGeral.forEach(([p, s]) => addNorm('TEALT', 'SP', 'Geral', 'Geral', p, s));

// TEALT - SP Idade
const spIdadeData = [
  [1, 33, -86, -92, 19, -115],
  [5, 54, 34, 36, 22, 22],
  [10, 60, 44, 46, 27, 37],
  [15, 66, 50, 51, 38, 43],
  [20, 70, 55, 54, 46, 48],
  [25, 73, 60, 59, 50, 56],
  [30, 78, 65, 65, 54, 58],
  [35, 80, 67, 68, 61, 61],
  [40, 83, 70, 73, 64, 68],
  [45, 87, 73, 76, 65, 73],
  [50, 93, 77, 78, 69, 75],
  [55, 97, 80, 79, 71, 79],
  [60, 100, 83, 81, 76, 84],
  [65, 101, 87, 83, 82, 92],
  [70, 104, 93, 86, 88, 98],
  [75, 108, 97, 91, 96, 104],
  [80, 113, 101, 101, 108, 111],
  [85, 118, 106, 106, 113, 118],
  [90, 122, 113, 118, 116, 123],
  [95, 124, 122, 125, 121, 126],
  [99, 127, 128, 128, 128, 128]
];
spIdadeData.forEach(row => {
  const p = row[0];
  row.slice(1).forEach((s, i) => addNorm('TEALT', 'SP', 'Faixa Etária', prIdadeCols[i], p, s));
});

// TEALT - SP Escolaridade
const spEscData = [
  [1, -90, 3, 33],
  [5, 20, 34, 54],
  [10, 34, 43, 61],
  [15, 43, 51, 66],
  [20, 47, 55, 68],
  [25, 51, 58, 70],
  [30, 55, 60, 73],
  [35, 58, 63, 76],
  [40, 60, 64, 80],
  [45, 63, 68, 83],
  [50, 64, 71, 87],
  [55, 68, 75, 97],
  [60, 70, 80, 101],
  [65, 75, 84, 105],
  [70, 80, 90, 115],
  [75, 84, 103, 120],
  [80, 88, 107, 122],
  [85, 102, 112, 124],
  [90, 112, 122, 126],
  [95, 122, 126, 127],
  [99, 126, 128, 128]
];
spEscData.forEach(row => {
  const p = row[0];
  row.slice(1).forEach((s, i) => addNorm('TEALT', 'SP', 'Escolaridade', prEscCols[i], p, s));
});

// TEALT - SE Geral
const seGeral = [
  [1, -84], [5, 63], [10, 77], [15, 93], [20, 98], [25, 104], [30, 107], [35, 111], [40, 115], [45, 118],
  [50, 119], [55, 120], [60, 121], [65, 122], [70, 123], [75, 124], [80, 125], [85, 126], [90, 126], [95, 127], [99, 128]
];
seGeral.forEach(([p, s]) => addNorm('TEALT', 'SE', 'Geral', 'Geral', p, s));

// TEALT - SE Idade
const seIdadeData = [
  [1, -12, -18, -60, -25, -20],
  [5, 69, 64, 30, 62, 23],
  [10, 88, 77, 62, 68, 24],
  [15, 98, 83, 68, 76, 29],
  [20, 104, 88, 71, 80, 40],
  [25, 107, 94, 83, 87, 52],
  [30, 111, 97, 88, 89, 58],
  [35, 116, 101, 93, 89, 67],
  [40, 118, 104, 98, 94, 86],
  [45, 120, 108, 110, 104, 96],
  [50, 122, 112, 115, 106, 104],
  [55, 123, 116, 117, 109, 110],
  [60, 124, 119, 119, 114, 111],
  [65, 125, 120, 121, 116, 112],
  [70, 126, 121, 122, 117, 114],
  [75, 126, 123, 124, 119, 115],
  [80, 127, 124, 126, 121, 122],
  [85, 127, 125, 126, 123, 124],
  [90, 128, 126, 127, 125, 125],
  [95, 128, 127, 127, 126, 126],
  [99, 128, 128, 128, 128, 127]
];
seIdadeData.forEach(row => {
  const p = row[0];
  row.slice(1).forEach((s, i) => addNorm('TEALT', 'SE', 'Faixa Etária', prIdadeCols[i], p, s));
});

// TEALT - MS Escolaridade
const msEscData = [
  [1, 35, 48, 11],
  [5, 44, 59, 62],
  [10, 50, 66, 77],
  [15, 67, 76, 83],
  [20, 64, 80, 88],
  [25, 67, 84, 92],
  [30, 69, 88, 95],
  [35, 71, 93, 99],
  [40, 74, 97, 101],
  [45, 81, 100, 104],
  [50, 85, 102, 106],
  [55, 89, 106, 109],
  [60, 94, 110, 111],
  [65, 98, 113, 115],
  [70, 102, 117, 117],
  [75, 108, 120, 122],
  [80, 118, 124, 124],
  [85, 124, 125, 125],
  [90, 126, 127, 127],
  [95, 128, 128, 128],
  [99, 128, 128, 128]
];
msEscData.forEach(row => {
  const p = row[0];
  row.slice(1).forEach((s, i) => addNorm('TEALT', 'MS', 'Escolaridade', prEscCols[i], p, s));
});


const fs = require('fs');
let sql = 'INSERT INTO public.psychological_test_norms (test_name, state, division_type, division_name, percentile, score, classification) VALUES\n';

const values = norms.map(n => 
  `('${n.test_name}', '${n.state}', '${n.division_type}', '${n.division_name}', ${n.percentile}, ${n.score}, '${n.classification}')`
);

sql += values.join(',\n') + '\nON CONFLICT (test_name, state, division_type, division_name, percentile) DO UPDATE SET score = EXCLUDED.score, classification = EXCLUDED.classification;';

fs.writeFileSync('c:\\Users\\ACPO Empreendimentos\\Documents\\Github\\gestaopessoas.github.io\\supabase\\migrations\\20260721000001_seed_tealt_norms.sql', sql);
console.log('Seed SQL created.');
