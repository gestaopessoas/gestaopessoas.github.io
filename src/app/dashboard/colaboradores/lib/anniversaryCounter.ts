import { isValid } from "date-fns";
import type { Employee } from "../components/types";

export const countWorkAnniversaries = (
  employees: Employee[],
  referenceMonthIndex: number // 0-11
) => {
  const currentYear = new Date().getFullYear();

  return employees.filter((e) => {
    // Must be active
    if (!["Ativo", "Férias", "Afastado"].includes(e.status ?? "")) return false;
    
    if (!e.admission_date) return false;
    const adm = new Date(e.admission_date + "T12:00:00");
    if (!isValid(adm)) return false;

    // Must be in the reference month
    if (adm.getMonth() !== referenceMonthIndex) return false;

    // Must be at least 1 year (0 years is not an anniversary)
    const years = currentYear - adm.getFullYear();
    return years > 0;
  }).length;
};
