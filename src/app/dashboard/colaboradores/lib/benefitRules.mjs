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
    || savedName.startsWith(`${configuredName} - NIVEL `)
    || savedName.startsWith(`${configuredName} - CARTAO `);
}

export function getEmployeeBenefitLevelLabel(employeeBenefitName, companyBenefitName) {
  const savedName = normalizeBenefitName(employeeBenefitName);
  const configuredName = normalizeBenefitName(companyBenefitName);
  
  const levelPrefix = `${configuredName} - NIVEL `;
  if (savedName.startsWith(levelPrefix)) {
    return `Nível ${savedName.slice(levelPrefix.length)}`;
  }

  const cardPrefix = `${configuredName} - CARTAO `;
  if (savedName.startsWith(cardPrefix)) {
    return `Cartão ${employeeBenefitName.split(/ - Cartão /i)[1] || savedName.slice(cardPrefix.length)}`;
  }

  return null;
}
