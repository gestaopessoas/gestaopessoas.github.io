import assert from "node:assert/strict";
import test from "node:test";

import { summarizeSalaryRoles, groupByRegimeAndLevel, levelsInUse, NO_SENIORITY_KEY } from "./salaryTableViewRules.mjs";

test("resume salários sem nível por modalidade", () => {
  const [role] = summarizeSalaryRoles([
    {
      role_name: "Oficial",
      role_code: "C-1",
      uses_level: false,
      modality: "CLT",
      salary_experience: 2221.71,
      salary_after_probation: 2352.26,
    },
    {
      role_name: "Oficial",
      role_code: "C-1",
      uses_level: false,
      modality: "PJ",
      salary_experience: 2554.97,
      salary_after_probation: 2705.1,
    },
  ]);

  assert.equal(role.usesLevel, false);
  assert.deepEqual(role.salariesByModality.CLT, {
    experience: 2221.71,
    afterProbation: 2352.26,
  });
  assert.deepEqual(role.salariesByModality.PJ, {
    experience: 2554.97,
    afterProbation: 2705.1,
  });
});

test("expõe rótulos contextuais e prioriza a faixa sem nível em dados mistos", () => {
  const roles = summarizeSalaryRoles([
    {
      role_name: "Almoxarife",
      role_code: "C-2",
      uses_level: true,
      modality: "CLT",
      level: "I",
      salary: 2580.58,
    },
    {
      role_name: "Almoxarife",
      role_code: "C-2",
      uses_level: false,
      modality: "CLT",
      salary_experience: 2221.71,
      salary_after_probation: null,
    },
    {
      role_name: "Analista",
      role_code: "C-3",
      uses_level: true,
      modality: "CLT",
      level: "Júnior",
      salary: 3000,
    },
  ]);

  assert.deepEqual(
    roles.map(({ name, structureLabel, actionLabel }) => ({
      name,
      structureLabel,
      actionLabel,
    })),
    [
      {
        name: "Almoxarife",
        structureLabel: "Sem nível",
        actionLabel: "Gerenciar salários",
      },
      {
        name: "Analista",
        structureLabel: "Com nível",
        actionLabel: "Gerenciar níveis",
      },
    ],
  );
  assert.equal(roles[0].salariesByModality.CLT.afterProbation, null);
  assert.deepEqual(roles[1].salariesByModality, {});
});

test("groupByRegimeAndLevel agrupa por CLT/PJ, senioridade e nível", () => {
  const rows = [
    { id: "1", uses_level: true, modality: "CLT", seniority: "Júnior", level: "Nível I", salary: 2000 },
    { id: "2", uses_level: true, modality: "CLT", seniority: "Pleno", level: "Nível I", salary: 3000 },
    { id: "3", uses_level: true, modality: "PJ", seniority: "Sênior", level: "Nível II", salary: 5000 },
  ];

  const grouped = groupByRegimeAndLevel(rows);
  assert.equal(grouped.CLT["Júnior"]["Nível I"].salary, 2000);
  assert.equal(grouped.CLT["Pleno"]["Nível I"].salary, 3000);
  assert.equal(grouped.PJ["Sênior"]["Nível II"].salary, 5000);
  assert.equal(grouped.CLT["Júnior"]["Nível II"], undefined);
});

test("groupByRegimeAndLevel não confunde nível com senioridade e não sobrescreve entre senioridades", () => {
  const rows = [
    { id: "1", uses_level: true, modality: "CLT", seniority: "Júnior", level: "Nível I", salary: 2000 },
    { id: "2", uses_level: true, modality: "CLT", seniority: "Pleno", level: "Nível I", salary: 3500 },
    { id: "3", uses_level: true, modality: "CLT", seniority: "Sênior", level: "Nível I", salary: 5000 },
  ];

  const grouped = groupByRegimeAndLevel(rows);
  // As três senioridades para o mesmo Nível I devem coexistir, não se sobrescrever.
  assert.equal(grouped.CLT["Júnior"]["Nível I"].salary, 2000);
  assert.equal(grouped.CLT["Pleno"]["Nível I"].salary, 3500);
  assert.equal(grouped.CLT["Sênior"]["Nível I"].salary, 5000);
});

test("groupByRegimeAndLevel usa NO_SENIORITY_KEY pra cargo sem senioridade cadastrada", () => {
  const rows = [
    { id: "1", uses_level: true, modality: "CLT", seniority: null, level: "Nível I", salary: 2048 },
  ];

  const grouped = groupByRegimeAndLevel(rows);
  assert.equal(grouped.CLT[NO_SENIORITY_KEY]["Nível I"].salary, 2048);
});

test("groupByRegimeAndLevel: regime sem nenhum nível cadastrado não quebra", () => {
  const rows = [
    { id: "1", uses_level: false, modality: "CLT", salary_experience: 2000, salary_after_probation: 2200 },
  ];
  const grouped = groupByRegimeAndLevel(rows);
  assert.deepEqual(grouped.CLT, {});
  assert.deepEqual(grouped.PJ, {});
});

test("levelsInUse retorna só os níveis presentes, na ordem padrão", () => {
  const rows = [
    { uses_level: true, level: "Nível III", salary: 1 },
    { uses_level: true, level: "Nível I", salary: 1 },
    { uses_level: true, level: "Nível X", salary: 1 },
  ];
  assert.deepEqual(levelsInUse(rows), ["Nível I", "Nível III", "Nível X"]);
});

test("levelsInUse: nível sem cargo cadastrado retorna lista vazia, não erro", () => {
  assert.deepEqual(levelsInUse([]), []);
});
