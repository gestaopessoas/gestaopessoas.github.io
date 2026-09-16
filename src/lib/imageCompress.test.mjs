import assert from 'node:assert/strict';
import { chooseSmallest, fitDimensions, MAX_DIMENSION } from './imageCompress.mjs';

// Foto em pé de celular: encolhe pelo maior lado e mantém a proporção.
assert.deepEqual(fitDimensions(3024, 4032), { width: 1200, height: 1600 });
// Deitada: o maior lado continua sendo o que manda.
assert.deepEqual(fitDimensions(4032, 3024), { width: 1600, height: 1200 });
// Já cabe no teto: passa intacta, ampliar só inventaria pixel.
assert.deepEqual(fitDimensions(800, 600), { width: 800, height: 600 });
// Exatamente no teto também não mexe.
assert.deepEqual(fitDimensions(MAX_DIMENSION, 900), { width: MAX_DIMENSION, height: 900 });
// Quadrada gigante vira quadrada no teto.
assert.deepEqual(fitDimensions(5000, 5000), { width: 1600, height: 1600 });

console.log('ok — fitDimensions mantém proporção e nunca amplia');

// chooseSmallest: o original é o piso, e o menor candidato ganha.
const blob = (size, type) => ({ blob: { size }, contentType: type });
const original = blob(4_000_000, 'image/jpeg');
assert.equal(chooseSmallest([blob(300_000, 'image/webp'), blob(420_000, 'image/jpeg')], original).contentType, 'image/webp');
// Safari antigo devolve PNG no lugar de WebP: o PNG é maior e perde para o JPEG.
assert.equal(chooseSmallest([blob(2_100_000, 'image/png'), blob(410_000, 'image/jpeg')], original).contentType, 'image/jpeg');
// Foto já minúscula: reencode sai maior e o original fica.
assert.equal(chooseSmallest([blob(9_000, 'image/webp')], blob(6_000, 'image/jpeg')).blob.size, 6_000);
// Nenhum encoder respondeu: sobra o original.
assert.equal(chooseSmallest([null, null], original), original);

console.log('ok — chooseSmallest confia no tamanho que voltou, não no tipo pedido');
