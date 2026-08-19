import { differenceInDays, differenceInYears, isValid } from "date-fns";
import type { Employee } from "../components/types";

export const computeCounters = (
  employees: Employee[],
  referenceMonthIndex: number // 0-11
) => {
  const today = new Date();

  return {
    total: employees.length,
    active: employees.filter((e) => ["Ativo", "Férias", "Afastado"].includes(e.status ?? "")).length,
    birthdays: employees.filter((e) => {
      if (!e.birthday) return false;
      const bday = new Date(e.birthday + "T12:00:00");
      return isValid(bday) && bday.getMonth() === referenceMonthIndex;
    }).length,
    experience: employees.filter((e) => {
      if (!e.admission_date) return false;
      const adm = new Date(e.admission_date + "T12:00:00");
      return isValid(adm) && differenceInYears(today, adm) >= 10;
    }).length,
    alerts: employees.filter((e) => {
      if (!e.aso_date) return false;
      const aso = new Date(e.aso_date + "T12:00:00");
      return isValid(aso) && differenceInDays(aso, today) <= 30;
    }).length,
  };
};
