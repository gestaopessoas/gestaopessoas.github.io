import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizeOption,
  criticalFieldsMatch,
  getScheduleForWorkplaceType,
  isValidCpf,
  sanitizeRgInput,
  formatCurrencyInput,
  parseCurrencyInput,
  salaryChangeDue,
  maskCurrencyInput,
  levelFieldOptions,
  seniorityForLevel,
  seniorityOptionsFromRules,
} from "./employeeFormRules.mjs";
import * as employeeFormRules from "./employeeFormRules.mjs";

const ALL_LEVELS = ["", "Nível I", "Nível VI", "Nível XI", "Diretoria"];

test("oferece as opções adicionais de senioridade", () => {
  assert.deepEqual(employeeFormRules.SENIORITY_OPTIONS, [
    "",
    "Júnior",
    "Pleno",
    "Sênior",
    "Diretoria",
    "Não Enquadrado",
    "Não Aplicável",
  ]);
});

test("aceita CPF com dígitos verificadores corretos, com ou sem máscara", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("52998224725"), true);
});

test("rejeita CPF com dígito verificador errado, tamanho errado ou repetido", () => {
  assert.equal(isValidCpf("529.982.247-24"), false);
  assert.equal(isValidCpf("1234567890"), false);
  assert.equal(isValidCpf("111.111.111-11"), false);
  assert.equal(isValidCpf(""), false);
  assert.equal(isValidCpf(null), false);
});

test("cargo de campo não oferece senioridade e entra pelo piso", () => {
  const oficial = [{ role_name: "OFICIAL", modality: "CLT", uses_level: false, level: null }];
  const { showSeniority, levelOptions } = levelFieldOptions(oficial, undefined, ALL_LEVELS);

  assert.equal(showSeniority, false);
  assert.deepEqual(levelOptions, ["", "PISO", "Não Enquadrado"]);
});

test("cargo com nível e sem senioridade cadastrada mostra todos os níveis da faixa", () => {
  const analista = [
    { role_name: "ANALISTA", modality: "CLT", uses_level: true, level: "Nível I" },
    { role_name: "ANALISTA", modality: "CLT", uses_level: true, level: "Nível VI" },
  ];

  const semFiltro = levelFieldOptions(analista, "", ALL_LEVELS);
  assert.equal(semFiltro.showSeniority, true);
  assert.deepEqual(semFiltro.levelOptions, ["", "Nível I", "Nível VI", "PISO", "Não Enquadrado"]);

  // Sem senioridade no cadastro não há como filtrar: esconder opção seria pior que mostrar.
  const comSenioridadeEscolhida = levelFieldOptions(analista, "Júnior", ALL_LEVELS);
  assert.deepEqual(comSenioridadeEscolhida.levelOptions, ["", "Nível I", "Nível VI", "PISO", "Não Enquadrado"]);
});

// Cenário que originou o bug: os níveis se chamam "1".."5" DENTRO de cada senioridade, então
// o mesmo rótulo de nível existe em Júnior, Pleno e Sênior. Qualquer lógica que mapeie nível
// para senioridade globalmente erra aqui — a pista tem que ser o par (cargo, senioridade).
const assistente = [
  { role_name: "ASSISTENTE", modality: "CLT", uses_level: true, seniority: "Júnior", level: "1" },
  { role_name: "ASSISTENTE", modality: "CLT", uses_level: true, seniority: "Júnior", level: "2" },
  { role_name: "ASSISTENTE", modality: "CLT", uses_level: true, seniority: "Pleno", level: "1" },
  { role_name: "ASSISTENTE", modality: "CLT", uses_level: true, seniority: "Pleno", level: "2" },
];

test("níveis são filtrados pela senioridade escolhida, mesmo com rótulos repetidos", () => {
  const junior = levelFieldOptions(assistente, "Júnior", ALL_LEVELS);
  assert.deepEqual(junior.levelOptions, ["", "1", "2", "PISO", "Não Enquadrado"]);

  const pleno = levelFieldOptions(assistente, "Pleno", ALL_LEVELS);
  assert.deepEqual(pleno.levelOptions, ["", "1", "2", "PISO", "Não Enquadrado"]);
});

test("senioridades disponíveis saem da tabela salarial do cargo, sem repetir", () => {
  assert.deepEqual(seniorityOptionsFromRules(assistente), ["Júnior", "Pleno"]);
  assert.deepEqual(seniorityOptionsFromRules([]), []);
});

test("senioridade derivada do nível usa o dado do cargo e admite não saber", () => {
  // Rótulo repetido: a primeira regra que casa define, e nunca deve inventar quando não há dado.
  assert.equal(seniorityForLevel(assistente, "1"), "Júnior");
  assert.equal(seniorityForLevel(assistente, "9"), null);
  assert.equal(seniorityForLevel(assistente, ""), null);
  assert.equal(seniorityForLevel([{ uses_level: true, level: "1" }], "1"), null);
});

test("cargo com faixa larga (diretoria/coordenação) respeita a divisão cadastrada", () => {
  const coordenador = [
    ...Array.from({ length: 5 }, (_, i) => ({ role_name: "COORDENADOR", modality: "CLT", uses_level: true, seniority: "Júnior", level: String(i + 1) })),
    ...Array.from({ length: 5 }, (_, i) => ({ role_name: "COORDENADOR", modality: "CLT", uses_level: true, seniority: "Pleno", level: String(i + 6) })),
    ...Array.from({ length: 5 }, (_, i) => ({ role_name: "COORDENADOR", modality: "CLT", uses_level: true, seniority: "Sênior", level: String(i + 11) })),
  ];

  assert.deepEqual(levelFieldOptions(coordenador, "Júnior", ALL_LEVELS).levelOptions,
    ["", "1", "2", "3", "4", "5", "PISO", "Não Enquadrado"]);
  assert.deepEqual(levelFieldOptions(coordenador, "Sênior", ALL_LEVELS).levelOptions,
    ["", "11", "12", "13", "14", "15", "PISO", "Não Enquadrado"]);
  assert.equal(seniorityForLevel(coordenador, "13"), "Sênior");
});

test("cargo sem faixa cadastrada mantém todos os níveis mais piso", () => {
  const { showSeniority, levelOptions } = levelFieldOptions([], undefined, ALL_LEVELS);

  assert.equal(showSeniority, true);
  assert.deepEqual(levelOptions, [...ALL_LEVELS, "PISO", "Não Enquadrado"]);
});

test("converte opção legada para o valor canônico sem diferenciar caixa", () => {
  const options = ["Ativo", "Férias", "Afastado", "Inativo", "Desligado"];
  assert.equal(canonicalizeOption("ativo", options), "Ativo");
  assert.equal(canonicalizeOption("FÉRIAS", options), "Férias");
});

test("converte status legado inactive para Inativo", () => {
  const options = ["Ativo", "Férias", "Afastado", "Inativo", "Desligado"];
  assert.equal(canonicalizeOption("inactive", options), "Inativo");
});

test("mantém valor desconhecido para não apagar dados legados", () => {
  assert.equal(canonicalizeOption("Licença", ["Ativo"]), "Licença");
});

test("sugere jornada de obra", () => {
  assert.deepEqual(getScheduleForWorkplaceType("obra"), {
    work_schedule_start_1: "07:30",
    work_schedule_end_1: "12:00",
    work_schedule_start_2: "13:15",
    work_schedule_end_2: "17:33",
    weekly_hours: "44",
    work_days: "Segunda a Sexta",
  });
});

test("sede e plantão usam a mesma jornada", () => {
  const sede = getScheduleForWorkplaceType("SEDE");
  assert.deepEqual(getScheduleForWorkplaceType("PLANTÃO DE VENDAS"), sede);
  assert.deepEqual(getScheduleForWorkplaceType("plantao"), sede);
  assert.equal(sede?.work_schedule_start_1, "07:45");
  assert.equal(sede?.work_schedule_end_2, "17:48");
  assert.equal(sede?.weekly_hours, "44");
});

test("não sugere jornada para tipo desconhecido", () => {
  assert.equal(getScheduleForWorkplaceType("FILIAL"), null);
});

test("confere os campos críticos devolvidos pelo banco", () => {
  const expected = {
    rg: "001234567890123",
    profile_code: "C-0100",
    company_id: "company-1",
    workplace_id: "workplace-1",
    ficha: "F-001",
    marital_status: "Casado(a)",
    status: "Ativo",
  };

  assert.equal(criticalFieldsMatch(expected, { ...expected }), true);
  assert.equal(criticalFieldsMatch(expected, { ...expected, profile_code: null }), false);
  assert.equal(criticalFieldsMatch(expected, { ...expected, rg: "1234567890123" }), false);
  assert.equal(criticalFieldsMatch(expected, { ...expected, ficha: null }), false);
});

test("RG mantém somente os primeiros 15 dígitos e preserva zeros à esquerda", () => {
  assert.equal(sanitizeRgInput("00.123-ABC 4567890123456"), "001234567890123");
});

test("formata e converte salário brasileiro sem perder centavos", () => {
  assert.equal(formatCurrencyInput(12345.6), "12.345,60");
  assert.equal(parseCurrencyInput("12.345,60"), 12345.6);
  assert.equal(maskCurrencyInput("1234560"), "12.345,60");
  assert.equal(maskCurrencyInput(""), "");
});

test("avisa a troca salarial sete dias antes do fim da experiência", () => {
  assert.equal(salaryChangeDue("2026-05-15", 1839.21, 1839.21, 2352.26, "2026-08-06"), true);
  assert.equal(salaryChangeDue("2026-05-01", 1839.21, 1839.21, 2352.26, "2026-08-06"), true);
  assert.equal(salaryChangeDue("2026-05-15", 2352.26, 1839.21, 2352.26, "2026-08-06"), false);
});
