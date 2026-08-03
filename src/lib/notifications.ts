import { differenceInDays, isValid, parseISO } from "date-fns";

export type TrialNotification = {
  id: string;
  name: string;
  daysRemaining: number;
  isWarning: boolean;
};

export type RgsNotification = {
  id: string;
  name: string;
  type: string;
  daysPending: number;
};

export type BenefitNotification = {
  id: string;
  name: string;
  type: "INCLUSAO" | "CORTE";
};

export type PendingProfileNotification = {
  id: string;
  name: string;
  missingFields: string[];
};

export type UserPreferences = {
  trial: boolean;
  rgs: boolean;
  benefits: boolean;
  profile: boolean;
};

// Types corresponding to the fields fetched from DB
type EmployeeData = {
  id: string;
  name: string;
  admission_date?: string | null;
  contract_type?: string | null;
  status: string;
  registration_number?: string | null;
  birthday?: string | null;
  cost_center_id?: string | null;
  company_id?: string | null;
  workplace_id?: string | null;
  dismissed_at?: string | null;
};

type RgsData = {
  id: string;
  employee_name?: string | null;
  process_type?: string | null;
  created_at?: string | null;
  status: string;
};

type BenefitData = {
  employee_id: string;
  benefit_name?: string | null;
};

export function generatePendingProfileNotifications(
  employees: EmployeeData[],
  prefs: UserPreferences
): PendingProfileNotification[] {
  if (!prefs.profile) return [];
  const list: PendingProfileNotification[] = [];
  
  for (const emp of employees) {
    const missing: string[] = [];
    if (["Ativo", "Férias", "Afastado"].includes(emp.status)) {
      if (!emp.admission_date) missing.push("Admissão");
      if (!emp.registration_number) missing.push("Matrícula");
      if (!emp.birthday) missing.push("Nascimento");
      if (!emp.cost_center_id) missing.push("Centro de Custo");
      if (!emp.company_id) missing.push("Empresa");
      if (!emp.workplace_id) missing.push("Obra");
    } else if (["Inativo", "Desligado"].includes(emp.status)) {
      if (!emp.dismissed_at) missing.push("Desligamento");
    }
    
    if (missing.length > 0) {
      list.push({ id: emp.id, name: emp.name, missingFields: missing });
    }
  }
  
  return list;
}

export function generateTrialNotifications(
  employees: EmployeeData[],
  prefs: UserPreferences,
  today: Date = new Date()
): TrialNotification[] {
  if (!prefs.trial) return [];
  const list: TrialNotification[] = [];
  
  for (const emp of employees) {
    if (["Inativo", "Desligado"].includes(emp.status)) continue;
    if (!emp.admission_date) continue;
    if (emp.contract_type && emp.contract_type !== "CLT") continue;
    
    const admission = parseISO(emp.admission_date);
    if (!isValid(admission)) continue;
    
    const daysElapsed = differenceInDays(today, admission);
    const daysRemaining = 90 - daysElapsed;
    
    if (daysRemaining >= 0 && daysRemaining <= 15) {
      list.push({
        id: emp.id,
        name: emp.name,
        daysRemaining,
        isWarning: daysRemaining <= 7,
      });
    }
  }
  
  return list.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export function generateRgsNotifications(
  rgsProcesses: RgsData[],
  prefs: UserPreferences,
  today: Date = new Date()
): RgsNotification[] {
  if (!prefs.rgs) return [];
  const list: RgsNotification[] = [];
  
  for (const rgs of rgsProcesses) {
    if (!rgs.created_at) continue;
    const createdAt = parseISO(rgs.created_at);
    if (!isValid(createdAt)) continue;
    
    const daysPending = differenceInDays(today, createdAt);
    
    if (daysPending >= 3) {
      list.push({
        id: rgs.id,
        name: rgs.employee_name || "Desconhecido",
        type: rgs.process_type || "Processo",
        daysPending,
      });
    }
  }
  
  return list.sort((a, b) => b.daysPending - a.daysPending);
}

export function generateBenefitNotifications(
  employees: EmployeeData[],
  benefits: BenefitData[],
  prefs: UserPreferences,
  ignoredIds: string[] = [],
  today: Date = new Date()
): BenefitNotification[] {
  if (!prefs.benefits) return [];
  const list: BenefitNotification[] = [];

  const hasBenefitType = (empId: string, needle: string) =>
    benefits.some(b => b.employee_id === empId && (b.benefit_name || "").toLowerCase().includes(needle));

  for (const emp of employees) {
    // INCLUSAO: ativo/férias/afastado, >90 dias, sem saude/odonto/farmacia, não ignorado
    if (["Ativo", "Férias", "Afastado"].includes(emp.status)) {
      if (ignoredIds.includes(emp.id)) continue;
      if (!emp.admission_date) continue;
      const admission = parseISO(emp.admission_date);
      if (!isValid(admission)) continue;
      if (differenceInDays(today, admission) <= 90) continue;

      const hasSaude = hasBenefitType(emp.id, "saúde") || hasBenefitType(emp.id, "saude");
      const hasOdonto = hasBenefitType(emp.id, "odonto");
      const hasFarmacia = hasBenefitType(emp.id, "farmácia") || hasBenefitType(emp.id, "farmacia");

      if (!hasSaude || !hasOdonto || !hasFarmacia) {
        list.push({ id: emp.id, name: emp.name, type: "INCLUSAO" });
      }
      continue;
    }

    // CORTE: desligado com benefício ativo, não ignorado
    if (emp.status === "Desligado") {
      if (ignoredIds.includes(emp.id)) continue;
      const hasBenefits = benefits.some(b => b.employee_id === emp.id);
      if (hasBenefits) {
        list.push({ id: emp.id, name: emp.name, type: "CORTE" });
      }
    }
  }

  return list;
}
