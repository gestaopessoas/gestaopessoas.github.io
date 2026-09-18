import assert from 'node:assert/strict';
import { firstName, whatsappNumber, birthdayPhotoMessage, whatsappLink } from './birthdayInvite.mjs';

// O cadastro guarda o nome em caixa alta.
assert.equal(firstName("BRUNO DE SOUZA GONÇALVES"), "Bruno");
assert.equal(firstName("  maria  clara "), "Maria");
assert.equal(firstName(null), "");

// Celular e fixo ganham o 55; o que já tem 55 não ganha de novo.
assert.equal(whatsappNumber("(53) 99999-8888"), "5553999998888");
assert.equal(whatsappNumber("(53) 3232-8888"), "555332328888");
assert.equal(whatsappNumber("5553999998888"), "5553999998888");
// Telefone pela metade abriria uma conversa vazia no WhatsApp em vez de dar erro.
assert.equal(whatsappNumber("99999"), null);
assert.equal(whatsappNumber(""), null);
assert.equal(whatsappNumber(null), null);

const texto = birthdayPhotoMessage({ name: "ANA PAULA DIAS", link: "https://x/enviar-foto?t=abc", deadline: "25/09/2026" });
assert.match(texto, /Olá, Ana, tudo bem\?/);
assert.match(texto, /🔗 https:\/\/x\/enviar-foto\?t=abc/);
assert.match(texto, /até o dia 25\/09\/2026/);
// Os buracos do texto base não podem sobrar na mensagem enviada.
assert.doesNotMatch(texto, /\[Inserir|\[Nome/);

// O link tem que sobreviver ao encode: quebra de linha e emoji vão na query string.
const url = whatsappLink("(53) 99999-8888", texto);
assert.ok(url.startsWith("https://wa.me/5553999998888?text="));
assert.equal(decodeURIComponent(url.split("?text=")[1]), texto);
assert.equal(whatsappLink("123", texto), null);

console.log("birthdayInvite ok");
