// Run with: node src/components/careers/types.test.mjs
// (assert puro, sem framework; Node >= 22.6 lê o .ts direto por type stripping)
import assert from "node:assert"
import { splitProfileList, formatSalaryRange } from "./types.ts"

// O caso da issue #102: `knowledge` traz a lista e `competencies` repete a mesma, e o portal
// juntava tudo numa frase só — "Habilidade manual Organização e limpeza ... Habilidade manual
// Organização e limpeza", grudado e em dobro.
const lista = "Habilidade manual\nOrganização e limpeza\nTrabalho em equipe\nResponsabilidade\nAdaptação e flexibilidade"
assert.deepStrictEqual(
  splitProfileList("Serviços essenciais da área", lista + "\n" + lista),
  [
    "Serviços essenciais da área",
    "Habilidade manual",
    "Organização e limpeza",
    "Trabalho em equipe",
    "Responsabilidade",
    "Adaptação e flexibilidade",
  ],
)

// Os separadores que aparecem no cadastro à mão.
assert.deepStrictEqual(splitProfileList("Leitura de projeto; Alvenaria · Reboco"), ["Leitura de projeto", "Alvenaria", "Reboco"])
assert.deepStrictEqual(splitProfileList("- Alvenaria\n- Reboco"), ["Alvenaria", "Reboco"])
assert.deepStrictEqual(splitProfileList("Corte a frio - manual"), ["Corte a frio", "manual"])

// Hífen dentro da palavra não quebra o item.
assert.deepStrictEqual(splitProfileList("Auto-organização"), ["Auto-organização"])

// Acento e caixa não criam item duplicado, e o exibido é o primeiro como foi digitado.
assert.deepStrictEqual(splitProfileList("Organização", "ORGANIZACAO"), ["Organização"])

// Pontuação solta no fim some; campo vazio ou nulo não vira item em branco.
assert.deepStrictEqual(splitProfileList("Alvenaria.", null, "", undefined, "   "), ["Alvenaria"])
assert.deepStrictEqual(splitProfileList(null, undefined), [])

// Faixa salarial, que já existia sem teste.
assert.strictEqual(formatSalaryRange(null, null), "A combinar")
assert.strictEqual(formatSalaryRange(2000, 2000), formatSalaryRange(2000, null))

console.log("types.test.mjs passed")
