// Lista de Cortes Pós-Demissão: agrupa por employee.id para blindar contra
// duplicidade da consulta de employees (fan-out de embed, registro repetido etc).
// Ver issue #30 - Ajuste de Bug VR.

export interface CutListEmployee {
  id: string;
  name: string;
  status: string;
  department?: string;
  workplaceType?: string;
}

export interface CutListBenefit {
  employee_id: string;
  benefit_type: string;
  value?: number;
}

export interface CutListEntry {
  employee: CutListEmployee;
  benefitTypes: string[];
  totalValue: number;
}

export const buildVrCutList = (
  employees: CutListEmployee[],
  benefits: CutListBenefit[]
): CutListEntry[] => {
  const entries = new Map<string, CutListEntry>();

  for (const emp of employees) {
    if (emp.status !== "Desligado") continue;
    if (entries.has(emp.id)) continue; // mantém dados do primeiro registro encontrado

    const empBenefits = benefits.filter((b) => b.employee_id === emp.id);
    if (empBenefits.length === 0) continue;

    entries.set(emp.id, {
      employee: emp,
      benefitTypes: [...new Set(empBenefits.map((b) => b.benefit_type))],
      totalValue: empBenefits.reduce((sum, b) => sum + (b.value || 0), 0),
    });
  }

  return [...entries.values()];
};
