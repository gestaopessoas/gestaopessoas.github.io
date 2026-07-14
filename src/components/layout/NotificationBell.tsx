"use client";

import { useEffect, useState, useRef } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { differenceInDays, isValid, parseISO } from "date-fns";
import Link from "next/link";

type TrialNotification = {
  id: string;
  name: string;
  daysRemaining: number;
  isWarning: boolean;
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<TrialNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, admission_date, contract_type")
        .neq("status", "Arquivo Morto")
        .neq("status", "Desligado")
        .neq("status", "Inativo");

      if (error || !data) return;

      const today = new Date();
      const trialList: TrialNotification[] = [];

      for (const emp of data) {
        if (!emp.admission_date) continue;
        // Se já tivermos o tipo de contrato e não for CLT, não tem período de experiência
        if (emp.contract_type && emp.contract_type !== "CLT") continue;
        const admission = parseISO(emp.admission_date);
        if (!isValid(admission)) continue;
        
        const daysElapsed = differenceInDays(today, admission);
        const daysRemaining = 90 - daysElapsed;
        
        // Mostramos no sininho aqueles que estão a 15 dias ou menos de acabar a experiência
        if (daysRemaining >= 0 && daysRemaining <= 15) {
          trialList.push({
            id: emp.id,
            name: emp.name,
            daysRemaining,
            isWarning: daysRemaining <= 7,
          });
        }
      }

      trialList.sort((a, b) => a.daysRemaining - b.daysRemaining);
      setNotifications(trialList);
    };

    fetchNotifications();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative flex items-center" ref={dropdownRef}>
      <button 
        className="relative text-muted-foreground hover:text-primary transition-colors flex items-center justify-center"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5" />
        {notifications.length > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
            {notifications.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-3 w-80 rounded-xl border bg-card p-2 shadow-xl animate-in fade-in slide-in-from-top-2">
          <div className="mb-2 px-2 pb-2 pt-1 border-b">
            <h3 className="text-sm font-semibold text-foreground">Fim de Experiência</h3>
            <p className="text-xs text-muted-foreground">Colaboradores nos últimos 15 dias de contrato.</p>
          </div>
          
          {notifications.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">Nenhum aviso no momento.</div>
          ) : (
            <div className="flex max-h-80 flex-col gap-1 overflow-y-auto pr-1">
              {notifications.map(n => (
                <div key={n.id} className={`flex flex-col gap-1 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted ${n.isWarning ? "bg-red-50/50 dark:bg-red-950/20" : ""}`}>
                  <span className="font-medium text-foreground">{n.name}</span>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Faltam {n.daysRemaining} dias</span>
                    {n.isWarning && <span className="text-red-600 font-semibold bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded-sm">Atenção</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
