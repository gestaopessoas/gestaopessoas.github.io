import assert from "node:assert/strict";
import test from "node:test";

import { summarizeSalaryRoles } from "./salaryTableViewRules.mjs";

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

test("groupByRegimeAndLevel agrupa por CLT/PJ e níveis", async () => {
  const { groupByRegimeAndLevel } = await import("./salaryTableViewRules.mjs");
  const rows = [
    { id: "1", uses_level: true, modality: "CLT", level: "Júnior", salary: 2000 },
    { id: "2", uses_level: true, modality: "CLT", level: "Pleno", salary: 3000 },
    { id: "3", uses_level: true, modality: "PJ", level: "Sênior", salary: 5000 },
  ];
  
  const grouped = groupByRegimeAndLevel(rows);
  assert.equal(grouped.CLT["Júnior"].salary, 2000);
  assert.equal(grouped.CLT["Pleno"].salary, 3000);
  assert.equal(grouped.PJ["Sênior"].salary, 5000);
  assert.equal(grouped.CLT["PISO"], undefined);
});
