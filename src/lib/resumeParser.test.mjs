// Run with: node src/lib/resumeParser.test.mjs
// (plain assert test, no framework; Node >= 22.6 lê o .ts direto por type stripping)

import assert from "node:assert"
import { itemsToText, parseSolidesResume } from "./resumeParser.ts"

// --- itemsToText: colunas viram TAB, rodapé de página some ---------------------

const item = (str, x, y, width) => ({ str, transform: [0, 0, 0, 0, x, y], width })

const text = itemsToText([
  item("Data de nascimento", 30, 720, 104),
  item("CPF", 303, 720, 20),
  item("24/06/2002", 30, 705, 59),
  item("600.889.080-97", 303, 705, 76),
  item("Rua Álvaro", 30, 690, 55),
  item(" Chaves", 85, 690, 40),
  item("1 / 3", 280, 40, 20),
])

assert.strictEqual(
  text,
  "Data de nascimento\tCPF\n24/06/2002\t600.889.080-97\nRua Álvaro Chaves",
  `itemsToText inesperado:\n${JSON.stringify(text)}`,
)

// --- parseSolidesResume: currículo real exportado pela Sólides ----------------

const CV = [
  "Eduardo Aires Kath",
  "24 anos",
  "Pelotas - RS",
  "Não informado",
  "(53) 98405-3508",
  "Resumo profissional",
  "Busco por uma oportunidade na área jurídica na cidade de Pelotas, pois curso direito na UCPel.",
  "Atualmente, trabalho como estagiário na Prefeitura de Pelotas no Setor de Atos Oficiais e Aposentadoria",
  "na Secretaria de Recursos Humanos.",
  "Experiência profissional",
  "ESTAGIÁRIO – SECRETARIA DE RECURSOS HUMANOS",
  "Prefeitura Municipal de Pelotas",
  "Descrição",
  "Apoio em rotinas administrativas, organização de documentos, planilhas e sistemas internos.",
  "Atendimento relacionados à aposentadoria e suporte às demandas do setor.",
  "Período",
  "05/2025 até o momento",
  "ESTAGIÁRIO",
  "3º Registro de Imóveis de Pelotas",
  "Descrição",
  "Organização e arquivamento de processos imobiliários. Conferência documental e suporte às rotinas do",
  "cartório. Atendimento básico e apoio às rotinas internas da serventia.",
  "Período",
  "05/2024 até 08/2024 (3 mes(es))",
  "OPERADOR DE CAIXA",
  "Macro Atacado Krolow",
  "Descrição",
  "Atendimento ao cliente e operação de caixa. Abertura, fechamento e zelo pelos valores sob",
  "responsabilidade.",
  "Período",
  "02/2022 até 12/2022 (10 mes(es))",
  "ESTAGIÁRIO – TESOURARIA",
  "Prefeitura Municipal de São Lourenço do Sul",
  "Descrição",
  "Trâmite interno e externo de documentos e valores. Lançamentos administrativos e atendimento ao",
  "público. Organização de arquivos e interface com instituições bancárias.",
  "Período",
  "01/2020 até 02/2022 (2 ano(s) 1 mes(es))",
  "1 / 3",
  "Formação",
  "DIREITO",
  "UCPel - Superior Completo",
  "Ano de conclusão",
  "2027",
  "Cursos e certificações",
  "Não informado",
  "Habilidades",
  "PACOTE OFFICE - Intermediário",
  "Idiomas",
  "INGLÊS - Intermediário",
  "Informações adicionais",
  "2 / 3",
  "Pretensão Salarial",
  "R$ 2.200,00",
  "Possui CNH?\tCategoria da CNH",
  "Sim\tB,A",
  "Informações pessoais",
  "Data de nascimento\tCPF",
  "24/06/2002\t600.889.080-97",
  "Email\tEmail Secundário",
  "eduardoaireskath@gmail.com\teduardokath@proton.me",
  "Telefone\tCelular",
  "(53) 98405-3508\t(53) 98405-3508",
  "Diversidade",
  "Sexo\tRaça/cor",
  "Homem\tBranca",
  "Orientação sexual\tGênero",
  "Heterossexual\tCisgênero",
  "Endereço",
  "Cidade\tPaís",
  "Pelotas\tBrasil",
  "Endereço",
  "Rua Álvaro Chaves, Centro, Pelotas, Rio Grande do Sul, 96010-760, Brasil",
  "3 / 3",
].join("\n")

const cv = parseSolidesResume(CV)

const expected = {
  name: "Eduardo Aires Kath",
  age: "24",
  location: "Pelotas - RS",
  email: "eduardoaireskath@gmail.com",
  secondary_email: "eduardokath@proton.me",
  phone: "(53) 98405-3508",
  secondary_phone: "",
  cpf: "600.889.080-97",
  birth_date: "24/06/2002",
  cnh: "Sim",
  cnh_category: "B,A",
  has_cnh: true,
  salary_expectation: "R$ 2.200,00",
  gender: "Homem",
  race_declaration: "Branca",
  sexual_orientation: "Heterossexual",
  gender_identity: "Cisgênero",
  address: "Rua Álvaro Chaves, Centro, Pelotas, Rio Grande do Sul, 96010-760, Brasil",
  role: "",
  additional_info: "",
  personal_info: "",
  diversity_info: "",
}

for (const [key, value] of Object.entries(expected)) {
  assert.deepStrictEqual(cv[key], value, `campo "${key}": esperado ${JSON.stringify(value)}, veio ${JSON.stringify(cv[key])}`)
}

assert.deepStrictEqual(cv.cnh_categories, ["B", "A"])
assert.ok(
  !cv.experience_summary.split("\n").some((line) => /^\d+\s*\/\s*\d+$/.test(line.trim())),
  "rodapé de página vazou para o resumo de experiência",
)
assert.ok(cv.professional_summary.startsWith("Busco por uma oportunidade"))

// Formação
assert.strictEqual(cv.academic_list.length, 1)
assert.deepStrictEqual(cv.academic_list[0].course, "DIREITO (Superior Completo)")
assert.deepStrictEqual(cv.academic_list[0].institution, "UCPel")
assert.deepStrictEqual(cv.academic_list[0].end_date, "2027")
assert.strictEqual(cv.education, "DIREITO (Superior Completo) - UCPel")

// Experiências
assert.strictEqual(cv.experience_list.length, 4)
assert.deepStrictEqual(
  cv.experience_list.map((exp) => [exp.role, exp.company, exp.start_date, exp.end_date, exp.is_current]),
  [
    ["ESTAGIÁRIO – SECRETARIA DE RECURSOS HUMANOS", "Prefeitura Municipal de Pelotas", "05/2025", "", true],
    ["ESTAGIÁRIO", "3º Registro de Imóveis de Pelotas", "05/2024", "08/2024", false],
    ["OPERADOR DE CAIXA", "Macro Atacado Krolow", "02/2022", "12/2022", false],
    ["ESTAGIÁRIO – TESOURARIA", "Prefeitura Municipal de São Lourenço do Sul", "01/2020", "02/2022", false],
  ],
)
assert.ok(
  cv.experience_list[0].description.startsWith("Apoio em rotinas administrativas"),
  "descrição da primeira experiência não foi montada",
)

// Curso em andamento marca in_progress mesmo com ano passado
const cursando = parseSolidesResume(
  ["Formação", "ENGENHARIA CIVIL", "UFPel - Superior Incompleto", "Ano de conclusão", "2020"].join("\n"),
)
assert.strictEqual(cursando.academic_list[0].in_progress, true)

console.log("resumeParser.test.mjs passed")
