"use client";

import { Users, Cake, Activity, AlertCircle, AlertTriangle } from "lucide-react";
import { Employee, MONTHS } from "./types";
import { differenceInDays, differenceInYears, isValid } from "date-fns";

interface StatsCardsProps {
  employees: Employee[];
}

export function StatsCards({ employees }: StatsCardsProps) {
  const today = new Date();
  const currentMonth = today.getMonth();

  const stats = {
    total: employees.length,
    active: employees.filter((e) => ["Ativo", "Férias", "Afastado"].includes(e.status ?? "")).length,
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
      // Sem aso_date = "não informado", não conta como vencendo (M1)
      if (!e.aso_date) return false;
      const aso = new Date(e.aso_date + "T12:00:00");
      return isValid(aso) && differenceInDays(aso, today) <= 30;
    }).length,
  };

  const cards = [
    { label: "Total", value: stats.total, icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "Ativos", value: stats.active, icon: Activity, color: "text-emerald-600", bg: "bg-emerald-100" },
    { label: "Aniversariantes (" + MONTHS[currentMonth] + ")", value: stats.birthdays, icon: Cake, color: "text-amber-600", bg: "bg-amber-100" },
    { label: "Experiencia 10+ anos", value: stats.experience, icon: AlertTriangle, color: "text-purple-600", bg: "bg-purple-100" },
    { label: "ASO Vencendo (30d)", value: stats.alerts, icon: AlertCircle, color: "text-red-600", bg: "bg-red-100" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="text-2xl font-bold">{card.value}</p>
            </div>
            <div className={card.bg + " " + card.color + " p-3 rounded-lg"}>
              <card.icon className="w-5 h-5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
