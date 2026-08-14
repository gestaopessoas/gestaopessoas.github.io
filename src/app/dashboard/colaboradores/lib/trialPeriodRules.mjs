const DAY_MS = 86_400_000;

const parseDateOnly = (value) => {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
};

const toDateOnly = (date) => date.toISOString().slice(0, 10);

export const trialEndDate = (admissionDate) => {
  const admission = parseDateOnly(admissionDate);
  if (!admission) return null;
  admission.setUTCDate(admission.getUTCDate() + 90);
  return toDateOnly(admission);
};

export const openTrialPeriods = (employees, completedEmployeeIds = new Set(), today = new Date()) =>
  (employees ?? [])
    .flatMap((employee) => {
      if (!employee?.id || !employee.admission_date || completedEmployeeIds.has(employee.id)) return [];
      if (!['Ativo', 'Férias', 'Afastado'].includes(employee.status)) return [];
      if (employee.contract_type && employee.contract_type !== 'CLT') return [];

      const endDate = trialEndDate(employee.admission_date);
      const end = parseDateOnly(endDate);
      if (!end) return [];

      const reference = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
      const daysRemaining = Math.round((end.getTime() - reference) / DAY_MS);

      return [{
        id: employee.id,
        name: employee.name,
        daysRemaining,
        endDate,
        isWarning: daysRemaining <= 7,
        isOverdue: daysRemaining < 0,
      }];
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
