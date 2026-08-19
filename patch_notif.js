const fs = require('fs');
let code = fs.readFileSync('src/lib/notifications.ts', 'utf-8');

const interfaceStr = 'export type PendingProfileNotification = {';
const newInterface = `export type MonthlyBenefitNotification = {
  id: string;
  name: string;
  benefits: string[];
};

export type PendingProfileNotification = {`;

code = code.replace(interfaceStr, newInterface);

const fnStr = 'export function generatePendingProfileNotifications(';
const newFn = `export function generateMonthlyBenefitNotifications(
  employees: EmployeeData[],
  activeBenefits: { employee_id: string; benefit_name: string }[],
  monthlyEntries: { employee_id: string; benefit_name: string; reference_month: string }[],
  referenceMonth: string,
  reminderDay: number,
  today: Date = new Date()
): MonthlyBenefitNotification[] {
  if (today.getDate() < reminderDay) return [];

  const pendingMap = new Map<string, { name: string, benefits: string[] }>();

  activeBenefits.forEach(ab => {
    if (ab.benefit_name !== "Comissão" && ab.benefit_name !== "Variável Garantida") return;
    
    const isFilled = monthlyEntries.some(m => m.employee_id === ab.employee_id && m.benefit_name === ab.benefit_name && m.reference_month === referenceMonth);
    if (!isFilled) {
      const emp = employees.find(e => e.id === ab.employee_id);
      if (emp) {
        if (!pendingMap.has(ab.employee_id)) {
          pendingMap.set(ab.employee_id, { name: emp.name, benefits: [] });
        }
        pendingMap.get(ab.employee_id).benefits.push(ab.benefit_name);
      }
    }
  });

  return Array.from(pendingMap.entries()).map(([id, data]) => ({
    id,
    name: data.name,
    benefits: data.benefits
  }));
}

export function generatePendingProfileNotifications(`;

code = code.replace(fnStr, newFn);

fs.writeFileSync('src/lib/notifications.ts', code);
