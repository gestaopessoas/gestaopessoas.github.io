"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, UserX, AlertTriangle, Briefcase, ChevronRight, HeartPulse, DollarSign } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import {
  TrialNotification,
  RgsNotification,
  BenefitNotification,
  MonthlyBenefitNotification,
  PendingProfileNotification,
  UserPreferences,
  EmployeeData,
  RgsData,
  BenefitData,
  generatePendingProfileNotifications,
  generateTrialNotifications,
  generateRgsNotifications,
  generateBenefitNotifications,
  generateMonthlyBenefitNotifications
} from "@/lib/notifications";
import { errorMessage } from "@/lib/utils";

export function NotificationBell() {
  const [trialNotifications, setTrialNotifications] = useState<TrialNotification[]>([]);
  const [rgsNotifications, setRgsNotifications] = useState<RgsNotification[]>([]);
  const [benefitNotifications, setBenefitNotifications] = useState<BenefitNotification[]>([]);
  const [monthlyBenefitNotifications, setMonthlyBenefitNotifications] = useState<MonthlyBenefitNotification[]>([]);
  const [pendingProfiles, setPendingProfiles] = useState<PendingProfileNotification[]>([]);
  const [pendingLeads, setPendingLeads] = useState<number>(0);
  const [_preferences, setPreferences] = useState<UserPreferences>({ trial: true, rgs: true, benefits: true, profile: true });
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchNotifications = async () => {
      const supabase = createClient();

      const { data: authData } = await supabase.auth.getUser();
      let userPrefs = { trial: true, rgs: true, benefits: true, profile: true };

      if (authData.user?.id) {
        const { data: prof } = await supabase.from('profile_preferences').select('notify_trial, notify_rgs, notify_benefits, notify_profile').eq('profile_id', authData.user.id).maybeSingle();
        if (prof) {
          userPrefs = { ...userPrefs, trial: prof.notify_trial, rgs: prof.notify_rgs, benefits: prof.notify_benefits, profile: prof.notify_profile };
          setPreferences(userPrefs);
        }
      }

      // employees tem ~4.8k registros; o PostgREST limita a 1000 por query.
      // Paginamos via .range() para nao perder colaboradores (bug do badge estatico).
      const EMP_PAGE = 1000;
      let empData: EmployeeData[] = [];
      let empError: { message: string } | null = null;
      try {
        for (let from = 0; from < 10000; from += EMP_PAGE) {
          const { data, error } = await supabase
            .from("employees")
            .select("id, name, admission_date, contract_type, status, registration_number, birthday, cost_center_id, company_id, workplace_id, dismissed_at")
            .neq("status", "Arquivo Morto")
            .range(from, from + EMP_PAGE - 1);
          if (error) { empError = error; break; }
          empData = empData.concat((data ?? []) as unknown as EmployeeData[]);
          if ((data || []).length < EMP_PAGE) break; // última página
        }
      } catch (e) { empError = { message: errorMessage(e) }; }

      const referenceMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

      const [
        { data: rgsData, error: rgsError },
        { data: bens },
        { data: igs },
        { data: leadsData },
        { data: reminderEntries },
        { data: monthlyData }
      ] = await Promise.all([
        supabase
          .from("rgs_processes")
          .select("id, employee_name, process_type, created_at, status")
          .eq("status", "Pendente"),
        supabase.from("employee_benefits").select("employee_id, benefit_name"),
        supabase.from("benefit_ignores").select("employee_id"),
        supabase.from("partner_leads").select("id").neq("status", "atendido"),
        supabase
          .from("system_setting_entries")
          .select("path, value_text")
          .eq("setting_key", "monthly_benefits"),
        supabase
          .from("employee_monthly_benefits")
          .select("employee_id, benefit_name, reference_month")
          .eq("reference_month", referenceMonth)
      ]);

      setPendingLeads(leadsData ? leadsData.length : 0);

      if (!empError && empData) {
        const ignoredIds = (igs || []).map(i => (i as { employee_id: string }).employee_id);
        setPendingProfiles(generatePendingProfileNotifications(empData, userPrefs));
        setTrialNotifications(generateTrialNotifications(empData, userPrefs));
        setBenefitNotifications(generateBenefitNotifications(empData, (bens ?? []) as unknown as BenefitData[], userPrefs, ignoredIds));
        
        const reminderEntry = (reminderEntries ?? []).find((e: { path: string[] }) => e.path[0] === "reminder_day") as { value_text?: string } | undefined;
        const reminderDay = reminderEntry?.value_text ? Number(reminderEntry.value_text) : 15;
        const monthlyNotes = generateMonthlyBenefitNotifications(
          empData,
          bens as any,
          (monthlyData ?? []) as any,
          referenceMonth,
          reminderDay
        );
        setMonthlyBenefitNotifications(monthlyNotes);
      }

      if (!rgsError && rgsData) {
        setRgsNotifications(generateRgsNotifications(rgsData as unknown as RgsData[], userPrefs));
      }
    };

    fetchNotifications();
    window.addEventListener("notificationsUpdated", fetchNotifications);

    // Polling periódico (60s): atualiza o sino mesmo sem Realtime ativo.
    // O canal postgres_changes abaixo depende da extensão realtime instalada
    // (hoje ausente no projeto) — o interval é o mecanismo garantido de refresh.
    const pollId = window.setInterval(fetchNotifications, 60_000);

    // Supabase Realtime (redundante quando a extensão estiver ativa)
    const supabase = createClient();
    const channel = supabase
      .channel('notifications-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rgs_processes' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_benefits' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_leads' }, () => fetchNotifications())
      .subscribe();

    return () => {
      window.removeEventListener("notificationsUpdated", fetchNotifications);
      window.clearInterval(pollId);
      supabase.removeChannel(channel);
    };
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

  const totalCount = trialNotifications.length + rgsNotifications.length + benefitNotifications.length + monthlyBenefitNotifications.length + pendingProfiles.length + pendingLeads;
  
  const cutsCount = benefitNotifications.filter(b => b.type === "CORTE").length;
  const inclusionsCount = benefitNotifications.filter(b => b.type === "INCLUSAO").length;

  return (
    <div className="relative flex items-center" ref={dropdownRef}>
      <button 
        className="relative text-muted-foreground hover:text-primary transition-colors flex items-center justify-center"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5" />
        {totalCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-3 w-80 rounded-xl border bg-card p-0 shadow-xl animate-in fade-in slide-in-from-top-2 max-h-[85vh] overflow-y-auto">
          {totalCount === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma notificação no momento.</div>
          ) : (
            <div className="flex flex-col">
              {/* Pendências de Cadastro */}
              {pendingProfiles.length > 0 && (
                <div className="border-b last:border-b-0 pb-2">
                  <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-2 flex items-center justify-between z-10 border-b">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <UserX className="h-3.5 w-3.5 text-purple-500" /> Cadastro Incompleto
                    </h3>
                    <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingProfiles.length}</span>
                  </div>
                  <div className="px-2 pt-2 flex flex-col gap-1 max-h-[160px] overflow-y-auto">
                    {pendingProfiles.map(n => (
                      <button 
                        key={n.id} 
                        onClick={() => { setIsOpen(false); router.push(`/dashboard/colaboradores?edit=${n.id}`); }}
                        className="flex flex-col gap-1 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted text-left w-full group"
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-foreground">{n.name}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {n.missingFields.map(f => (
                            <span key={f} className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">{f}</span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Novos Parceiros / Resgates no Clube de Descontos */}
              {pendingLeads > 0 && (
                <div className="border-b last:border-b-0 pb-2">
                  <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-2 flex items-center justify-between z-10 border-b">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <span>🤝</span> Novos Parceiros &amp; Resgates
                    </h3>
                    <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">{pendingLeads}</span>
                  </div>
                  <div className="px-2 pt-2 flex flex-col gap-1">
                    <button 
                      onClick={() => { setIsOpen(false); router.push("/dashboard/parceiros?tab=leads"); }}
                      className="flex flex-col gap-1 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted text-left w-full group bg-emerald-50/40 dark:bg-emerald-950/20"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-foreground">Resgates Pendentes no Clube</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="text-xs mt-0.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                        {pendingLeads} {pendingLeads === 1 ? 'novo resgate ou candidato' : 'novos resgates ou candidatos'} aguardando avaliação
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Lançamentos Mensais */}
              {monthlyBenefitNotifications.length > 0 && (
                <div className="border-b last:border-b-0 pb-2">
                  <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-2 flex items-center justify-between z-10 border-b">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-amber-500" /> Benefícios Mensais
                    </h3>
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{monthlyBenefitNotifications.length}</span>
                  </div>
                  <div className="px-2 pt-2 flex flex-col gap-1">
                    {monthlyBenefitNotifications.map((n) => (
                      <div key={n.id} className="text-sm p-2 bg-muted/30 rounded-md hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => { setIsOpen(false); router.push("/dashboard/beneficios"); }}>
                        <div className="font-medium text-foreground">{n.name}</div>
                        <div className="text-xs text-muted-foreground">Pendente: {n.benefits.join(", ")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Benefícios */}
              {benefitNotifications.length > 0 && (
                <div className="border-b last:border-b-0 pb-2">
                  <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-2 flex items-center justify-between z-10 border-b">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <HeartPulse className="h-3.5 w-3.5 text-pink-500" /> Benefícios
                    </h3>
                    <span className="bg-pink-100 text-pink-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{benefitNotifications.length}</span>
                  </div>
                  <div className="px-2 pt-2 flex flex-col gap-1">
                    {inclusionsCount > 0 && (
                      <button 
                        onClick={() => { setIsOpen(false); router.push("/dashboard/beneficios?tab=planos"); }}
                        className="flex flex-col gap-1 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted text-left w-full group"
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-foreground">Inclusões Pendentes</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-xs mt-0.5 text-pink-600 font-medium">
                          {inclusionsCount} {inclusionsCount === 1 ? 'colaborador elegível' : 'colaboradores elegíveis'} sem plano
                        </div>
                      </button>
                    )}
                    
                    {cutsCount > 0 && (
                      <button 
                        onClick={() => { setIsOpen(false); router.push("/dashboard/beneficios?tab=cortes"); }}
                        className="flex flex-col gap-1 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted text-left w-full group bg-red-50/50 dark:bg-red-950/20"
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-foreground">Cortes de Benefícios</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex items-center justify-between text-xs mt-0.5">
                          <span className="text-red-600 font-medium">
                            {cutsCount} ex-colaborador{cutsCount === 1 ? '' : 'es'} ainda com benefício!
                          </span>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* RGS Pendentes */}
              {rgsNotifications.length > 0 && (
                <div className="border-b last:border-b-0 pb-2">
                  <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-2 flex items-center justify-between z-10 border-b">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> RGS Pendentes
                    </h3>
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{rgsNotifications.length}</span>
                  </div>
                  <div className="px-2 pt-2 flex flex-col gap-1">
                    {rgsNotifications.map(n => (
                      <button 
                        key={n.id} 
                        onClick={() => { setIsOpen(false); router.push("/dashboard/rgs"); }}
                        className="flex flex-col gap-1 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted text-left w-full group"
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-foreground">{n.name}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex items-center justify-between text-xs mt-0.5">
                          <span className="text-muted-foreground">{n.type}</span>
                          <span className="text-amber-600 font-medium">Há {n.daysPending} dias</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Fim de Experiência */}
              {trialNotifications.length > 0 && (
                <div className="pb-2">
                  <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-2 flex items-center justify-between z-10 border-b">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-blue-500" /> Fim de Experiência
                    </h3>
                    <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{trialNotifications.length}</span>
                  </div>
                  <div className="px-2 pt-2 flex flex-col gap-1">
                    {trialNotifications.map(n => (
                      <button 
                        key={n.id} 
                        onClick={() => { setIsOpen(false); router.push(`/dashboard/colaboradores?edit=${n.id}`); }}
                        className={`flex flex-col gap-1 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted text-left w-full group ${n.isWarning ? "bg-red-50/50 dark:bg-red-950/20" : ""}`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-foreground">{n.name}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex items-center justify-between text-xs mt-0.5">
                          <span className="text-muted-foreground">Faltam {n.daysRemaining} dias</span>
                          {n.isWarning && <span className="text-red-600 font-semibold bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded-sm">Atenção</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
            </div>
          )}
        </div>
      )}
    </div>
  );
}
