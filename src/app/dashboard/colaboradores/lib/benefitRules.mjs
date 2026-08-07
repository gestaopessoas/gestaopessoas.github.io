function normalizeBenefitName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleUpperCase("pt-BR");
}

export function matchesEmployeeBenefit(employeeBenefitName, companyBenefitName) {
  const savedName = normalizeBenefitName(employeeBenefitName);
  const configuredName = normalizeBenefitName(companyBenefitName);

  return savedName === configuredName
    || savedName.startsWith(`${configuredName} - NIVEL `);
}

export function getEmployeeBenefitLevelLabel(employeeBenefitName, companyBenefitName) {
  const savedName = normalizeBenefitName(employeeBenefitName);
  const levelPrefix = `${normalizeBenefitName(companyBenefitName)} - NIVEL `;

  if (!savedName.startsWith(levelPrefix)) return null;
  return `Nível ${savedName.slice(levelPrefix.length)}`;
}
