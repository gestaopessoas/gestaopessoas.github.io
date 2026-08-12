// Run with: node src/lib/mpDocx.test.mjs
// (plain assert test, no framework; Node >= 22.6 lê o .ts direto por type stripping)

import assert from "node:assert"
import { Packer } from "docx"
import JSZip from "jszip"
import { buildMpContratacaoDocument, MP_CONTROL_CODE, MP_REVISION } from "./mpDocx.ts"

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
  MP_CONTROL_CODE,
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
  "CONTRATAÇÃO DE NOVOS COLABORADORES",
]) {
  assert.ok(plain.includes(section), `seção ausente no docx: ${section}`)
}

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

// Dourado da identidade visual aparece nas faixas e badges.
assert.ok(xml.includes("DEAA30"), "faixa dourada ausente")

console.log("mpDocx.test.mjs passed")
