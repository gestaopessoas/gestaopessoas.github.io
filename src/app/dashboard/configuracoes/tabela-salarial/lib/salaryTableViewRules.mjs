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
