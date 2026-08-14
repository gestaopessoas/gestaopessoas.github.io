// Run with: node src/lib/mpDocx.test.mjs
// (plain assert test, no framework; Node >= 22.6 lê o .ts direto por type stripping)

import assert from "node:assert"
import { Packer } from "docx"
import JSZip from "jszip"
import { buildMpContratacaoDocument, buildMpMovimentacaoDocument, MP_REVISION } from "./mpDocx.ts"

const data = {
  candidateName: "Eduardo Aires Kath",
  phone: "(53) 98405-3508",
  email: "eduardoaireskath@gmail.com",
  registration: "12345",
  role: "Assistente Administrativo",
  level: "II",
  profileCode: "ADM-002",
  location: "MOOV",
  sector: "Recursos Humanos",
  costCenter: "CC-100",
  modality: "CLT",
  salary: "R$ 2.200,00",
  schedule: "44h semanais",
  benefits: "Vale Refeição, Vale Transporte",
  requestedBy: "Bruno Souza",
  reason: "Substituição",
  customReason: "",
  replacementOf: "Maria Silva",
  justification: "Vaga aberta por desligamento.",
  createdAt: "12/08/2026",
  generatedBy: "Carla Rockenbach",
}

const buffer = await Packer.toBuffer(buildMpContratacaoDocument(data))
assert.ok(buffer.length > 5000, `docx pequeno demais: ${buffer.length} bytes`)

const zip = await JSZip.loadAsync(buffer)
const xml = await zip.file("word/document.xml").async("string")
// Word so abre o arquivo se as partes obrigatorias existirem.
for (const part of ["[Content_Types].xml", "word/document.xml", "word/styles.xml"]) {
  assert.ok(zip.file(part), `parte ausente no docx: ${part}`)
}

const plain = xml.replace(/<[^>]+>/g, "")

// Valores preenchidos chegam no documento.
for (const value of [
  data.candidateName,
  data.phone,
  data.email,
  data.role,
  data.location,
  data.salary,
  data.benefits,
  data.requestedBy,
  data.replacementOf,
  data.justification,
  data.generatedBy,
  MP_REVISION,
]) {
  assert.ok(plain.includes(value), `valor ausente no docx: ${value}`)
}

// Estrutura do formulario impresso.
for (const section of [
  "IDENTIFICAÇÃO",
  "FUNÇÃO E ALOCAÇÃO",
  "CONTRATO",
  "GESTÃO DA VAGA",
  "APROVAÇÕES",
  "FORMULÁRIO DE CONTRATAÇÃO",
]) {
  assert.ok(plain.includes(section), `seção ausente no docx: ${section}`)
}

// Horário / Escala é coletado no sistema mas não entra no impresso.
assert.ok(!plain.includes(data.schedule), "Horário / Escala não deveria ser impresso")

// A razao escolhida marca so o checkbox dela.
assert.ok(plain.includes("☒ Substituição"), "checkbox da razão escolhida não foi marcado")
assert.ok(plain.includes("☐ Aumento de quadro"), "checkbox não escolhido deveria ficar vazio")
assert.strictEqual((plain.match(/☒/g) || []).length, 1, "mais de um checkbox marcado")

// Razao livre cai no "Outra:".
const outra = await Packer.toBuffer(
  buildMpContratacaoDocument({ ...data, reason: "Outros", customReason: "Projeto novo" }),
)
const outraXml = (await (await JSZip.loadAsync(outra)).file("word/document.xml").async("string")).replace(/<[^>]+>/g, "")
assert.ok(outraXml.includes("☒ Outra: Projeto novo"), "razão livre não foi para o campo Outra")

// Paleta amostrada do formulario impresso: dourado das reguas e navy dos titulos.
assert.ok(xml.includes("C98A1F"), "dourado das réguas ausente")
assert.ok(xml.includes("0B2138"), "navy dos títulos ausente")
assert.ok(!xml.includes("F4F4F4"), "painel cinza não existe no formulário impresso")

// A movimentacao compartilha as primitivas; "Ficha" ja colapsou por causa do
// layout fixo quando a linha de 3 colunas seguia uma de 2.
const mov = await Packer.toBuffer(
  buildMpMovimentacaoDocument({
    candidateName: "Eduardo Aires Kath",
    phone: "(53) 98405-3508",
    email: "eduardoaireskath@gmail.com",
    registration: "12345",
    ficha: "678",
    current: {
      role: "Assistente Administrativo", level: "Nível II", location: "Joy", sector: "RH",
      costCenter: "963", profileCode: "C-0120", modality: "CLT", salary: "R$ 3.100,00",
      benefits: "VT",
    },
    newData: {
      role: "Analista Administrativo", level: "Nível I", location: "Joy II", sector: "RH",
      costCenter: "980", profileCode: "C-0130", modality: "CLT", salary: "R$ 4.703,31",
      benefits: "VT, VR - Nível III",
    },
    reason: "Promoção",
    customReason: "",
    justification: "Promoção por mérito.",
    requestedBy: "Bruno Souza",
    createdAt: "14/08/2026",
    generatedBy: "Carla Rockenbach",
  }),
)
const movPlain = (await (await JSZip.loadAsync(mov)).file("word/document.xml").async("string")).replace(/<[^>]+>/g, "")
for (const value of ["Ficha", "678", "DADOS ATUAIS", "DADOS ALTERADOS", "Carla Rockenbach", MP_REVISION]) {
  assert.ok(movPlain.includes(value), `valor ausente na MP de movimentação: ${value}`)
}

console.log("mpDocx.test.mjs passed")
