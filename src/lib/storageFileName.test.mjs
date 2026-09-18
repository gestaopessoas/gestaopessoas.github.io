import assert from 'node:assert/strict';
import {
  slug,
  dateParts,
  monthParts,
  extFromContentType,
  storageFileName,
  photoFileName,
  isDuplicateError,
  uploadUnique,
} from './storageFileName.mjs';

const dia = new Date(2026, 8, 17); // 17/09/2026 — mês em JS é zero-based.

// O caso da issue #134: propósito e data mandam, o nome do celular some.
assert.equal(photoFileName('perfil', 'image/webp', dia), 'foto_perfil_17_09_2026.webp');
// Segundo envio do mesmo tipo no mesmo dia não sobrescreve o primeiro.
assert.equal(photoFileName('perfil', 'image/webp', dia, 2), 'foto_perfil_17_09_2026_2.webp');
// image/jpeg vira .jpg, não .jpeg — é o que o resto do sistema já usa.
assert.equal(photoFileName('aniversario', 'image/jpeg', dia), 'foto_aniversario_17_09_2026.jpg');
// Acento no propósito não chega ao bucket.
assert.equal(photoFileName('admissão', 'image/webp', dia), 'foto_admissao_17_09_2026.webp');

console.log('ok — photoFileName ignora o nome do arquivo de entrada');

assert.equal(dateParts(new Date(2026, 0, 5)), '05_01_2026');
assert.equal(monthParts(new Date(2026, 8, 17)), '09_2026');
assert.equal(extFromContentType('image/svg+xml'), 'svg');
// Celular às vezes entrega contentType vazio: cai no fallback em vez de gerar ".undefined".
assert.equal(extFromContentType('', 'jpg'), 'jpg');
assert.equal(slug('Unimed Saúde & Cia'), 'unimed-saude-cia');

console.log('ok — data, competência, extensão e slug');

// Os outros três casos da issue #136.
assert.equal(storageFileName(['rg_cnh', dateParts(dia)], 'pdf'), 'rg_cnh_17_09_2026.pdf');
assert.equal(storageFileName(['holerite', monthParts(dia)], 'pdf'), 'holerite_09_2026.pdf');
assert.equal(storageFileName(['logo', slug('Unimed Saúde')], 'webp'), 'logo_unimed-saude.webp');

console.log('ok — o mesmo helper serve documento, holerite e logo');

assert.equal(isDuplicateError({ statusCode: '409', error: 'Duplicate' }), true);
assert.equal(isDuplicateError({ message: 'The resource already exists' }), true);
assert.equal(isDuplicateError({ message: 'Payload too large' }), false);

// uploadUnique: o bucket falso recusa o que já existe, como o Storage faz sem upsert.
const bucketFalso = (existentes) => ({
  tentados: [],
  async upload(path) {
    this.tentados.push(path);
    if (existentes.has(path)) return { error: { statusCode: '409', message: 'The resource already exists' } };
    existentes.add(path);
    return { error: null };
  },
});

const bucket = bucketFalso(new Set(['abc/perfil/foto_perfil_17_09_2026.webp']));
const r = await uploadUnique(bucket, 'abc/perfil', ['foto', 'perfil', dateParts(dia)], 'webp', 'blob');
assert.equal(r.error, null);
assert.equal(r.path, 'abc/perfil/foto_perfil_17_09_2026_2.webp');
assert.equal(bucket.tentados.length, 2); // tentou o nome limpo, levou 409, subiu com _2

// Erro que não é colisão volta na hora, sem ficar tentando sufixo.
const bucketQuebrado = { chamadas: 0, async upload() { this.chamadas++; return { error: { message: 'Payload too large' } }; } };
const ruim = await uploadUnique(bucketQuebrado, 'abc', ['foto'], 'webp', 'blob');
assert.equal(ruim.path, null);
assert.equal(ruim.error.message, 'Payload too large');
assert.equal(bucketQuebrado.chamadas, 1);

console.log('ok — uploadUnique desvia da colisão e não engole erro de verdade');
