export function summarizeSalaryRoles(rows) {
  const roles = new Map();

  for (const row of rows) {
    let role = roles.get(row.role_name);
    if (!role) {
      role = {
        name: row.role_name,
        code: row.role_code || "-",
        usesLevel: true,
        salariesByModality: {},
      };
      roles.set(row.role_name, role);
    }

    if (row.uses_level === false) {
      role.usesLevel = false;
      if (!role.salariesByModality[row.modality]) {
        role.salariesByModality[row.modality] = {
          experience: row.salary_experience,
          afterProbation: row.salary_after_probation,
        };
      }
    }
  }

  return Array.from(roles.values(), (role) => ({
    ...role,
    structureLabel: role.usesLevel ? "Com nível" : "Sem nível",
    actionLabel: role.usesLevel ? "Gerenciar níveis" : "Gerenciar salários",
  }));
}

// Ordem canônica dos níveis salariais (não confundir com senioridade: Júnior/
// Pleno/Sênior é outra dimensão, guardada separadamente na coluna `seniority`).
export const STANDARD_LEVELS = [
  "Nível I", "Nível II", "Nível III", "Nível IV", "Nível V",
  "Nível VI", "Nível VII", "Nível VIII", "Nível IX", "Nível X",
  "Nível XI", "Nível XII", "Nível XIII", "Nível XIV", "Nível XV",
];

// Sentinela pra cargos sem senioridade cadastrada (ex.: "Administrativo de
// Obras" só tem níveis, sem Júnior/Pleno/Sênior) — evita usar null como chave.
export const NO_SENIORITY_KEY = "__sem_senioridade__";

// Agrupa por regime (CLT/PJ) -> senioridade (ou NO_SENIORITY_KEY) -> nível.
// Um cargo pode ter Júnior/Pleno/Sênior, cada um com seus próprios 5 (ou mais)
// níveis e valores — replica a estrutura da planilha original.
export function groupByRegimeAndLevel(rows) {
  const byRegime = {
    CLT: {},
    PJ: {},
  };

  for (const row of rows) {
    if (!row.uses_level || !row.level) continue;
    if (!byRegime[row.modality]) {
      byRegime[row.modality] = {};
    }
    const seniorityKey = row.seniority || NO_SENIORITY_KEY;
    if (!byRegime[row.modality][seniorityKey]) {
      byRegime[row.modality][seniorityKey] = {};
    }
    byRegime[row.modality][seniorityKey][row.level] = row;
  }

  return byRegime;
}

// Só os níveis que esse conjunto de variantes realmente usa, na ordem padrão —
// alguns cargos têm 5 níveis, outros até 15; a grade acompanha o cargo.
export function levelsInUse(rows) {
  const present = new Set(rows.filter((r) => r.uses_level && r.level).map((r) => r.level));
  return STANDARD_LEVELS.filter((level) => present.has(level));
}
