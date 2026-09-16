import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// masks.ts é TypeScript sem tipos no corpo — remove as anotações e avalia.
const src = readFileSync(new URL("./masks.ts", import.meta.url), "utf8").replace(/: string/g, "");
const mod = await import("data:text/javascript," + encodeURIComponent(src));
const { maskAddressNumber, maskUf, isValidPhone, maskCep, safeFileName } = mod;

// Número de endereço: aceita o que existe na vida real, barra texto corrido.
assert.equal(maskAddressNumber("355"), "355");
assert.equal(maskAddressNumber("123A"), "123A");
assert.equal(maskAddressNumber("S/N"), "S/N");
assert.equal(maskAddressNumber("ap 101, fundos"), "ap101fundo"); // corta em 10
assert.equal(maskAddressNumber("<script>x</script>"), "scriptx/sc"); // <, > e ; caem
assert.equal(maskAddressNumber("1234567890123"), "1234567890");

// UF: só letras, dois caracteres, maiúsculo.
assert.equal(maskUf("rs"), "RS");
assert.equal(maskUf("R5"), "R");
assert.equal(maskUf("Rio Grande do Sul"), "RI");
assert.equal(maskUf("12"), "");

// Telefone: fixo (10) e celular (11) passam; incompleto não.
assert.equal(isValidPhone("(53) 99181-2665"), true);
assert.equal(isValidPhone("(53) 9982-3983"), true);
assert.equal(isValidPhone("(53) 9982"), false);
assert.equal(isValidPhone(""), false);
assert.equal(isValidPhone("(53) 99181-26650"), false);

// CEP mascarado chega em 8 dígitos — é o gatilho do onChange.
assert.equal(maskCep("96200340"), "96200-340");
assert.equal(maskCep("abc96200340xyz"), "96200-340");

// Nome de arquivo vira caminho no Storage: nada de espaço, parêntese ou "../".
assert.equal(safeFileName("curriculo.pdf"), "curriculo.pdf");
assert.equal(safeFileName("curriculo_thiago_santos_corrigido(1) (1).pdf"), "curriculo_thiago_santos_corrigido-1---1-.pdf");
assert.equal(safeFileName("cv_leonã_xavier_da_silva-2.pdf"), "cv_leon-_xavier_da_silva-2.pdf");
assert.equal(safeFileName("../../etc/passwd"), "..-..-etc-passwd");
assert.equal(safeFileName("Currículo simples preto e cinza.pdf"), "Curr-culo-simples-preto-e-cinza.pdf");
assert.ok(safeFileName("a".repeat(200) + ".pdf").length <= 80);

console.log("ok — 23 asserts");
