import { isValid } from "date-fns";
import type { Employee } from "../components/types";

const ACTIVE_STATUSES = ["Ativo", "Férias", "Afastado"];

export interface WorkAnniversary {
  employee: Employee;
  info: { month: number; date: Date; day: number; years: number };
}

// Fonte única do "aniversário de casa": o cartão de contagem e a lista da aba
// precisam concordar. O fallback pra admission_date cobre os registros salvos
// antes da coluna company_anniversary existir.
export const listWorkAnniversaries = (
  employees: Employee[],
  referenceMonthIndex: number // 0-11
): WorkAnniversary[] => {
  const currentYear = new Date().getFullYear();

  return employees
    .flatMap((employee) => {
      if (!ACTIVE_STATUSES.includes(employee.status ?? "")) return [];

      const dateStr = employee.company_anniversary || employee.admission_date;
      if (!dateStr) return [];
      const date = new Date(dateStr + "T12:00:00");
      if (!isValid(date)) return [];

      if (date.getMonth() !== referenceMonthIndex) return [];

      // Ano de admissão não é aniversário — só a partir do primeiro ano completo.
      const years = currentYear - date.getFullYear();
      if (years <= 0) return [];

      return [{ employee, info: { month: date.getMonth(), date, day: date.getDate(), years } }];
    })
    .sort((a, b) => a.info.day - b.info.day);
};

export const countWorkAnniversaries = (employees: Employee[], referenceMonthIndex: number) =>
  listWorkAnniversaries(employees, referenceMonthIndex).length;
