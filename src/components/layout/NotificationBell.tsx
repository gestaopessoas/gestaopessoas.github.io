"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, UserX, AlertTriangle, Briefcase, ChevronRight, HeartPulse } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { differenceInDays, isValid, parseISO } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";

type TrialNotification = {
  id: string;
  name: string;
  daysRemaining: number;
  isWarning: boolean;
};

type RgsNotification = {
  id: string;
  name: string;
  type: string;
  daysPending: number;
};

type BenefitNotification = {
  id: string;
  name: string;
  type: "INCLUSAO" | "CORTE";
};

type PendingProfileNotification = {
  id: string;
  name: string;
  missingFields: string[];
};

export function NotificationBell() {
  const [trialNotifications, setTrialNotifications] = useState<TrialNotification[]>([]);
  const [rgsNotifications, setRgsNotifications] = useState<RgsNotification[]>([]);
  const [benefitNotifications, setBenefitNotifications] = useState<BenefitNotification[]>([]);
  const [pendingProfiles, setPendingProfiles] = useState<PendingProfileNotification[]>([]);
  const [preferences, setPreferences] = useState({ trial: true, rgs: true, benefits: true, profile: true });
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchNotifications = async () => {
      const supabase = createClient();
      const today = new Date();
      
      const { data: authData } = await supabase.auth.getUser();
      let userPrefs = { trial: true, rgs: true, benefits: true, profile: true };
      
      if (authData.user?.id) {
        const { data: prof } = await supabase.from('profiles').select('permissions').eq('id', authData.user.id).single();
        if (prof?.permissions?._preferences) {
          userPrefs = { ...userPrefs, ...prof.permissions._preferences };
          setPreferences(userPrefs);
        }
      }

      // 1. Fetch Employees for both Trial and Benefits
      const { data: empData, error: empError } = await supabase
        .from("employees")
        .select("id, name, admission_date, contract_type, status, registration_number, birthday, cost_center_id, company_id, workplace_id, dismissed_at")
        .neq("status", "Arquivo Morto");

      const trialList: TrialNotification[] = [];
      const pendingProfileList: PendingProfileNotification[] = [];
      
      if (!empError && empData) {
        for (const emp of empData) {
          // Pendências de Perfil
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
          if (missing.length > 0 && userPrefs.profile) {
            pendingProfileList.push({ id: emp.id, name: emp.name, missingFields: missing });
          }

          if (["Inativo", "Desligado"].includes(emp.status)) continue;
          if (!emp.admission_date) continue;
          if (emp.contract_type && emp.contract_type !== "CLT") continue;
          
          const admission = parseISO(emp.admission_date);
          if (!isValid(admission)) continue;
          
          const daysElapsed = differenceInDays(today, admission);
          const daysRemaining = 90 - daysElapsed;
          
          if (daysRemaining >= 0 && daysRemaining <= 15 && userPrefs.trial) {
            trialList.push({
              id: emp.id,
              name: emp.name,
              daysRemaining,
              isWarning: daysRemaining <= 7,
            });
          }
        }
        trialList.sort((a, b) => a.daysRemaining - b.daysRemaining);
        setTrialNotifications(trialList);
        setPendingProfiles(pendingProfileList);
      }

      // 2. Fetch RGS Notifications
      const { data: rgsData, error: rgsError } = await supabase
        .from("rgs_processes")
        .select("id, employee_name, process_type, created_at, status")
        .eq("status", "Pendente");

      if (!rgsError && rgsData) {
        const rgsList: RgsNotification[] = [];
        for (const rgs of rgsData) {
          if (!rgs.created_at) continue;
          const createdAt = parseISO(rgs.created_at);
          if (!isValid(createdAt)) continue;
          
          const daysPending = differenceInDays(today, createdAt);
          
          if (daysPending >= 3 && userPrefs.rgs) {
            rgsList.push({
              id: rgs.id,
              name: rgs.employee_name || "Desconhecido",
              type: rgs.process_type || "Processo",
              daysPending,
            });
          }
        }
        rgsList.sort((a, b) => b.daysPending - a.daysPending);
        setRgsNotifications(rgsList);
      }
      
      // 3. Fetch Benefits Notifications
      if (!empError && empData) {
        const { data: bens } = await supabase.from("employee_benefits").select("employee_id, benefit_name");
        const { data: igs } = await supabase.from("benefit_ignores").select("employee_id");
        
        const benefits = bens || [];
        const ignores = (igs || []).map(i => i.employee_id);
        const benefitList: BenefitNotification[] = [];
        
        for (const emp of empData) {
          // Pendentes de Corte (Desligados com benefício)
          if (emp.status === "Desligado") {
            const hasBenefits = benefits.some(b => b.employee_id === emp.id);
            if (hasBenefits && userPrefs.benefits) {
              benefitList.push({ id: emp.id, name: emp.name, type: "CORTE" });
            }
            continue;
          }
          
          // Elegíveis (Inclusão pendente) - Removido a pedido do usuário
          /*
          if (["Ativo", "Férias", "Afastado"].includes(emp.status)) {
            if (ignores.includes(emp.id)) continue;
            if (!emp.admission_date) continue;
            
            const admission = parseISO(emp.admission_date);
            if (!isValid(admission)) continue;
            
            const days = differenceInDays(today, admission);
            if (days <= 90) continue;
            
            const hasSaude = benefits.some(b => b.employee_id === emp.id && (b.benefit_name?.toLowerCase().includes('saúde') || b.benefit_name?.toLowerCase().includes('saude')));
            const hasOdonto = benefits.some(b => b.employee_id === emp.id && b.benefit_name?.toLowerCase().includes('odonto'));
            const hasFarmacia = benefits.some(b => b.employee_id === emp.id && (b.benefit_name?.toLowerCase().includes('farmácia') || b.benefit_name?.toLowerCase().includes('farmacia')));
            
            if (!hasSaude || !hasOdonto || !hasFarmacia) {
              if (userPrefs.benefits) {
                benefitList.push({ id: emp.id, name: emp.name, type: "INCLUSAO" });
              }
            }
          }
          */
        }
        
        setBenefitNotifications(benefitList);
      }

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

  const totalCount = trialNotifications.length + rgsNotifications.length + benefitNotifications.length + pendingProfiles.length;
  
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
