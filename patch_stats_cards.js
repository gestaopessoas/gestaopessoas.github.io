const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/colaboradores/components/StatsCards.tsx', 'utf-8');

// 1. imports
code = code.replace(
  'import { Users, Cake, Activity, AlertCircle, AlertTriangle } from "lucide-react";',
  'import { Users, Cake, Activity, AlertCircle, AlertTriangle, PartyPopper } from "lucide-react";\nimport { computeCounters } from "../lib/employeeCounters";\nimport { countWorkAnniversaries } from "../lib/anniversaryCounter";'
);

// 2. props
code = code.replace(
  'interface StatsCardsProps {\n  employees: Employee[];\n}',
  'interface StatsCardsProps {\n  employees: Employee[];\n  birthdayMode?: "atual" | "seguinte";\n}'
);

code = code.replace(
  'export function StatsCards({ employees }: StatsCardsProps) {',
  'export function StatsCards({ employees, birthdayMode = "atual" }: StatsCardsProps) {'
);

// 3. computing
const computeTarget = `  const today = new Date();
  const currentMonth = today.getMonth();

  const stats = {
    total: employees.length,
    active: employees.filter((e) => ["Ativo", "FÃ©rias", "Afastado"].includes(e.status ?? "")).length,
    birthdays: employees.filter((e) => {
      if (!e.birthday) return false;
      const bday = new Date(e.birthday + "T12:00:00");
      return isValid(bday) && bday.getMonth() === currentMonth;
    }).length,
    experience: employees.filter((e) => {
      if (!e.admission_date) return false;
      const adm = new Date(e.admission_date + "T12:00:00");
      return isValid(adm) && differenceInYears(today, adm) >= 10;
    }).length,
    alerts: employees.filter((e) => {
      // Sem aso_date = "nÃ£o informado", nÃ£o conta como vencendo (M1)
      if (!e.aso_date) return false;
      const aso = new Date(e.aso_date + "T12:00:00");
      return isValid(aso) && differenceInDays(aso, today) <= 30;
    }).length,
  };`;

const newCompute = `  const today = new Date();
  const currentMonth = today.getMonth();
  const referenceMonthIndex = birthdayMode === "seguinte" ? (currentMonth + 1) % 12 : currentMonth;

  const stats = computeCounters(employees, referenceMonthIndex);
  const anniversariesCount = countWorkAnniversaries(employees, referenceMonthIndex);`;

code = code.replace(computeTarget, newCompute);

// 4. cards list
const cardsTarget = `  const cards = [
    { label: "Total", value: stats.total, icon: Users, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950/50" },
    { label: "Ativos", value: stats.active, icon: Activity, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-950/50" },
    { label: "Aniversariantes (" + MONTHS[currentMonth] + ")", value: stats.birthdays, icon: Cake, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950/50" },
    { label: "ExperiÃªncia 10+ anos", value: stats.experience, icon: AlertTriangle, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-950/50" },
    { label: "ASO Vencendo (30d)", value: stats.alerts, icon: AlertCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-950/50" },
  ];`;
const newCardsList = `  const cards = [
    { label: "Total", value: stats.total, icon: Users, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950/50" },
    { label: "Ativos", value: stats.active, icon: Activity, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-950/50" },
    { label: "Aniversários (" + MONTHS[referenceMonthIndex] + ")", value: stats.birthdays, icon: Cake, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950/50" },
    { label: "Tempo de Casa (" + MONTHS[referenceMonthIndex] + ")", value: anniversariesCount, icon: PartyPopper, color: "text-pink-600 dark:text-pink-400", bg: "bg-pink-100 dark:bg-pink-950/50" },
    { label: "Experiência 10+ anos", value: stats.experience, icon: AlertTriangle, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-950/50" },
    { label: "ASO Vencendo (30d)", value: stats.alerts, icon: AlertCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-950/50" },
  ];`;

code = code.replace(cardsTarget, newCardsList);

// 5. grid cols
const gridTarget = 'className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"';
const newGrid = 'className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6"';
code = code.replace(gridTarget, newGrid);

fs.writeFileSync('src/app/dashboard/colaboradores/components/StatsCards.tsx', code);
