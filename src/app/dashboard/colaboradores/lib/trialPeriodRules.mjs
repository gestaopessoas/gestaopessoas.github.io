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

// Estágio e Jovem Aprendiz têm contrato com prazo: a data de fim é obrigatória no cadastro
// e o RH é avisado em três degraus (30, 20 e 10 dias). `stage` é o degrau atingido — 0 quando
// ainda falta mais de 30 dias. Sem data cadastrada entra na lista mesmo assim, para o RH
// preencher: é o caso de quem foi cadastrado antes do campo existir.
export const FIXED_TERM_CONTRACTS = ['Estágio', 'Jovem Aprendiz'];
const ALERT_STAGES = [10, 20, 30];

export const openContractEnds = (employees, today = new Date()) =>
  (employees ?? [])
    .flatMap((employee) => {
      if (!employee?.id || !FIXED_TERM_CONTRACTS.includes(employee.contract_type)) return [];
      if (!['Ativo', 'Férias', 'Afastado'].includes(employee.status)) return [];

      const end = parseDateOnly(employee.contract_end_date);
      const reference = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
      const daysRemaining = end ? Math.round((end.getTime() - reference) / DAY_MS) : null;

      return [{
        id: employee.id,
        endDate: end ? toDateOnly(end) : null,
        daysRemaining,
        stage: daysRemaining === null ? 0 : ALERT_STAGES.find((limit) => daysRemaining <= limit) ?? 0,
        isOverdue: daysRemaining !== null && daysRemaining < 0,
      }];
    })
    // Sem data primeiro: é pendência de cadastro, e não tem prazo para ordenar.
    .sort((a, b) => (a.daysRemaining ?? -Infinity) - (b.daysRemaining ?? -Infinity));
