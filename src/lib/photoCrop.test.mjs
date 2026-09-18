import assert from 'node:assert/strict';
import { parseCrop, cropStyle } from './photoCrop.mjs';

// photo_crop nulo é o estado de TODA foto enviada até hoje: a tela não pode quebrar nele.
assert.equal(parseCrop(null), null);
assert.equal(parseCrop(undefined), null);
assert.equal(parseCrop({}), null);
// Recorte de largura zero não é recorte — dividir por ele daria Infinity no estilo.
assert.equal(parseCrop({ x: 0, y: 0, width: 0, height: 50 }), null);
// jsonb às vezes volta como string do PostgREST.
assert.deepEqual(parseCrop('{"x":10,"y":20,"width":50,"height":40}'), { x: 10, y: 20, width: 50, height: 40 });
assert.equal(parseCrop('não é json'), null);

assert.deepEqual(cropStyle(null), { width: "100%", height: "100%", left: "0%", top: "0%", objectFit: "cover" });

// Recorte de metade da imagem a partir do canto: a foto dobra de tamanho e não desloca.
assert.deepEqual(cropStyle({ x: 0, y: 0, width: 50, height: 50 }),
  { width: "200%", height: "200%", left: "0%", top: "0%", objectFit: "cover" });

// Mesmo recorte, deslocado para o meio: dobra e sobe/anda o equivalente a um quadro.
assert.deepEqual(cropStyle({ x: 25, y: 25, width: 50, height: 50 }),
  { width: "200%", height: "200%", left: "-50%", top: "-50%", objectFit: "cover" });

// Recorte que pega a imagem inteira equivale a não recortar.
assert.deepEqual(cropStyle({ x: 0, y: 0, width: 100, height: 100 }),
  { width: "100%", height: "100%", left: "0%", top: "0%", objectFit: "cover" });

// Recorte pequeno no canto inferior direito: amplia 4x e puxa 3 quadros para cima e para a esquerda.
assert.deepEqual(cropStyle({ x: 75, y: 75, width: 25, height: 25 }),
  { width: "400%", height: "400%", left: "-300%", top: "-300%", objectFit: "cover" });

console.log('ok — cropStyle amplia e desloca, e foto sem recorte continua centralizada');
