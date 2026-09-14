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
    ...diagnosticarCargo(rows.filter((r) => r.role_name === role.name)),
  }));
}

// O que a tela precisa saber sobre um cargo ALEM da estrutura: quanto ele paga, e se a
// faixa tem problema.
//
// Os dois problemas existem na base e ninguem via, porque a tela so mostrava "Por nível"
// e escondia o resto atras de um modal:
//
//   - CONFLITO: a mesma combinacao (regime, nivel, senioridade) com DOIS salarios
//     diferentes. O preenchimento automatico escolhe um dos dois sem criterio.
//     Medido em 2026-09-10: 30 combinacoes, todas em "MESTRE DE OBRAS".
//   - DUPLICADA: a mesma combinacao repetida com o MESMO valor. Nao muda salario, mas
//     infla a tabela e esconde as que conflitam. Medido: 22 linhas.
export function diagnosticarCargo(linhasDoCargo) {
  const porCombinacao = new Map();
  const valores = [];

  for (const linha of linhasDoCargo) {
    const chave = [linha.modality, linha.level ?? "", linha.seniority ?? ""].join("|");
    if (!porCombinacao.has(chave)) porCombinacao.set(chave, []);
    porCombinacao.get(chave).push(linha);

    for (const v of [linha.salary, linha.salary_experience, linha.salary_after_probation]) {
      if (typeof v === "number" && Number.isFinite(v)) valores.push(v);
    }
  }

  let conflitos = 0;
  let duplicadas = 0;
  for (const grupo of porCombinacao.values()) {
    if (grupo.length < 2) continue;
    const distintos = new Set(grupo.map((l) => String(l.salary ?? "")));
    if (distintos.size > 1) conflitos += 1;
    else duplicadas += grupo.length - 1;
  }

  return {
    linhas: linhasDoCargo.length,
    faixa: valores.length ? { min: Math.min(...valores), max: Math.max(...valores) } : null,
    conflitos,
    duplicadas,
  };
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
