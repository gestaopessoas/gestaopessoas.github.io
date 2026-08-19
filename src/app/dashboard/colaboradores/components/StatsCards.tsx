"use client";

import { Users, Cake, Activity, AlertCircle, AlertTriangle, PartyPopper } from "lucide-react";
import { computeCounters } from "../lib/employeeCounters";
import { countWorkAnniversaries } from "../lib/anniversaryCounter";
import { Employee, MONTHS } from "./types";

interface StatsCardsProps {
  employees: Employee[];
  birthdayMode?: "atual" | "seguinte";
}

export function StatsCards({ employees, birthdayMode = "atual" }: StatsCardsProps) {
  const today = new Date();
  const referenceMonth = birthdayMode === "seguinte" ? (today.getMonth() + 1) % 12 : today.getMonth();

  const stats = computeCounters(employees, referenceMonth);
  const workAnniversaries = countWorkAnniversaries(employees, referenceMonth);

  const cards = [
    { label: "Total", value: stats.total, icon: Users, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950/50" },
    { label: "Ativos", value: stats.active, icon: Activity, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-950/50" },
    { label: "Aniversariantes (" + MONTHS[referenceMonth] + ")", value: stats.birthdays, icon: Cake, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950/50" },
    { label: "Aniversário de Casa (" + MONTHS[referenceMonth] + ")", value: workAnniversaries, icon: PartyPopper, color: "text-pink-600 dark:text-pink-400", bg: "bg-pink-100 dark:bg-pink-950/50" },
    { label: "Experiência 10+ anos", value: stats.experience, icon: AlertTriangle, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-950/50" },
    { label: "ASO Vencendo (30d)", value: stats.alerts, icon: AlertCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-950/50" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
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
