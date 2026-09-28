import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRequirements, serializeRequirements, splitItems } from "./requirements.mjs";

test("splitItems: separa por ; e quebra de linha, ignora vírgula, dedupe sem acento/caixa", () => {
  assert.deepEqual(splitItems("Excel, Word; excel\nWORD\nPower BI"), ["Excel, Word", "excel", "WORD", "Power BI"]);
  // "excel" e "Excel, Word" não colidem (o item inteiro é a chave); só repete quando bate normalizado
  assert.deepEqual(splitItems("Organização\norganizacao\nOrganização "), ["Organização"]);
});

test("required: ida e volta (formato novo)", () => {
  const text = "Escolaridade mínima: Alfabetizado\nExperiência mínima: 30 dias\nCNH: B";
  const block = parseRequirements(text, "required");
  assert.deepEqual(block, { education: "Alfabetizado", experience: "30 dias", cnh: "B", other: "" });
  assert.equal(serializeRequirements(block, "required"), text);
});

test("desired: ida e volta (formato novo, com chips)", () => {
  const text =
    "Escolaridade desejável: Ensino médio\n" +
    "Experiência desejável: 1 ano\n" +
    "Conhecimentos: item a; item b\n" +
    "Competências: Habilidade manual; Trabalho em equipe";
  const block = parseRequirements(text, "desired");
  assert.deepEqual(block, {
    education: "Ensino médio",
    experience: "1 ano",
    knowledge: ["item a", "item b"],
    competencies: ["Habilidade manual", "Trabalho em equipe"],
    other: "",
  });
  assert.equal(serializeRequirements(block, "desired"), text);
});

test("desired: formato antigo (item por linha) vira chip, com dedupe", () => {
  // Caso real do perfil PEDREIRO: a lista de competências vem duplicada na íntegra.
  const text =
    "Escolaridade desejável: Alfabetizado\n" +
    "Conhecimentos: Leitura de projeto\n" +
    "Uso de instrumentos de medição\n" +
    "Competências: Habilidade manual\n" +
    "Organização e limpeza\n" +
    "Trabalho em equipe\n" +
    "Habilidade manual\n" +
    "Organização e limpeza\n" +
    "Trabalho em equipe";
  const block = parseRequirements(text, "desired");
  assert.equal(block.education, "Alfabetizado");
  assert.deepEqual(block.knowledge, ["Leitura de projeto", "Uso de instrumentos de medição"]);
  assert.deepEqual(block.competencies, ["Habilidade manual", "Organização e limpeza", "Trabalho em equipe"]);
});

test("linha sem rótulo conhecido vai para Outros, sem perder dado, sempre no fim", () => {
  const text = "Observação qualquer\nEscolaridade mínima: Alfabetizado\nMais uma nota solta";
  const block = parseRequirements(text, "required");
  assert.equal(block.education, "Alfabetizado");
  assert.equal(block.other, "Observação qualquer\nMais uma nota solta");
  assert.equal(
    serializeRequirements(block, "required"),
    "Escolaridade mínima: Alfabetizado\nObservação qualquer\nMais uma nota solta"
  );
});

test("serializeRequirements: campo vazio não gera linha", () => {
  assert.equal(serializeRequirements({ education: "", experience: "", cnh: "", other: "" }, "required"), "");
  assert.equal(
    serializeRequirements({ education: "", experience: "", knowledge: [], competencies: [], other: "" }, "desired"),
    ""
  );
});
