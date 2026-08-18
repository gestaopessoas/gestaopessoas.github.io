// Run with: node src/lib/resumeDate.test.mjs
// (plain assert test, no framework; Node >= 22.6 lê o .ts direto por type stripping)
//
// Os casos abaixo são formatos de data que aparecem DE VERDADE nos currículos de
// Documents/Curriculos. Se um deles voltar a devolver null, um insert em
// candidate_educations / candidate_experiences perde a data silenciosamente.

import assert from "node:assert"
import { normalizeResumeDate } from "./resumeDate.ts"

const cases = [
  // já ISO
  ["2025-06-01", "2025-06-01"],
  ["2025-06", "2025-06-01"],
  ["2019", "2019-01-01"],

  // MM/AAAA e variações de separador
  ["06/2025", "2025-06-01"],
  ["5/2025", "2025-05-01"],
  ["05.2025", "2025-05-01"],

  // duração entre parênteses do export Sólides
  ["06/2025 (3 mes(es))", "2025-06-01"],
  ["02/2019 (1 ano(s) 1 mes(es))", "2019-02-01"],

  // data completa
  ["21/12/2020", "2020-12-21"],
  ["01/03/2021", "2021-03-01"],
  ["01.05.1995", "1995-05-01"],
  ["03/03/14", "2014-03-03"],

  // mês por extenso / abreviado
  ["ago. 2025", "2025-08-01"],
  ["jul. 2026", "2026-07-01"],
  ["Outubro de 2017", "2017-10-01"],
  ["NOVEMBRO 2025", "2025-11-01"],
  ["Março de 2021", "2021-03-01"],
  ["dez/2025", "2025-12-01"],

  // semestre acadêmico
  ["2026/1", "2026-01-01"],
  ["2026/2", "2026-07-01"],

  // não reconhecível => null, nunca string solta (quebraria a coluna `date`)
  ["Safra", null],
  ["1 Ano E 7 Meses", null],
  ["Cursando", null],
  ["6º semestre", null],
  ["De - Até", null],
  ["", null],
  [null, null],
  [undefined, null],

  // mês inválido não vira data
  ["13/2025", null],
  ["32/01/2020", null],
]

for (const [input, expected] of cases) {
  const actual = normalizeResumeDate(input)
  assert.strictEqual(
    actual,
    expected,
    `normalizeResumeDate(${JSON.stringify(input)}) => ${JSON.stringify(actual)}, esperado ${JSON.stringify(expected)}`,
  )
}

console.log(`resumeDate.test.mjs passed (${cases.length} casos)`)
