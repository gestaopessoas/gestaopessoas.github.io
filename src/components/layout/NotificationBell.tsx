"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, UserX, AlertTriangle, Briefcase, ChevronRight, HeartPulse, DollarSign } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import {
  NotificationSummary,
  EMPTY_NOTIFICATION_SUMMARY
} from "@/lib/notifications";

// O sino roda no layout do dashboard, ou seja, em toda página e em toda aba.
// Antes ele baixava a tabela employees inteira (1,4 MB) a cada 60s para calcular
// as notificações no browser — sozinho, ~700 MB/dia de egress. Agora é uma RPC
// que devolve só o resumo (~9 KB), com intervalo maior e pausada em aba oculta.
const POLL_MS = 5 * 60_000;

export function NotificationBell() {
  const [summary, setSummary] = useState<NotificationSummary>(EMPTY_NOTIFICATION_SUMMARY);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let lastFetch = 0;

    const fetchNotifications = async () => {
      lastFetch = Date.now();
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_notification_summary", { p_item_limit: 100 });
      if (cancelled || error || !data) return;
      setSummary(data as NotificationSummary);
    };

    // Aba oculta não gasta egress; ao voltar, atualiza se o dado já venceu.
    const tick = () => {
      if (document.visibilityState === "visible") fetchNotifications();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetch >= POLL_MS) {
        fetchNotifications();
      }
    };

    fetchNotifications();
    window.addEventListener("notificationsUpdated", fetchNotifications);
    document.addEventListener("visibilitychange", onVisibility);
    const pollId = window.setInterval(tick, POLL_MS);

    return () => {
      cancelled = true;
      window.removeEventListener("notificationsUpdated", fetchNotifications);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(pollId);
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

  // A RPC devolve contagem exata + os primeiros 100 itens de cada seção; o badge
  // usa a contagem, as listas usam os itens.
  const pendingProfiles = summary.profiles.items;
  const trialNotifications = summary.trial.items;
  const rgsNotifications = summary.rgs.items;
  const monthlyBenefitNotifications = summary.monthly.items;
  const pendingLeads = summary.pending_leads;
  const inclusionsCount = summary.benefits.inclusions;
  const cutsCount = summary.benefits.cuts;
  const benefitCount = inclusionsCount + cutsCount;

  const totalCount =
    summary.trial.count +
    summary.rgs.count +
    benefitCount +
    summary.monthly.count +
    summary.profiles.count +
    pendingLeads;

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
              {summary.profiles.count > 0 && (
                <div className="border-b last:border-b-0 pb-2">
                  <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-2 flex items-center justify-between z-10 border-b">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <UserX className="h-3.5 w-3.5 text-purple-500" /> Cadastro Incompleto
                    </h3>
                    <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{summary.profiles.count}</span>
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
              {summary.monthly.count > 0 && (
                <div className="border-b last:border-b-0 pb-2">
                  <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-2 flex items-center justify-between z-10 border-b">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-amber-500" /> Benefícios Mensais
                    </h3>
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{summary.monthly.count}</span>
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
              {benefitCount > 0 && (
                <div className="border-b last:border-b-0 pb-2">
                  <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-2 flex items-center justify-between z-10 border-b">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <HeartPulse className="h-3.5 w-3.5 text-pink-500" /> Benefícios
                    </h3>
                    <span className="bg-pink-100 text-pink-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{benefitCount}</span>
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
              {summary.rgs.count > 0 && (
                <div className="border-b last:border-b-0 pb-2">
                  <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-2 flex items-center justify-between z-10 border-b">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> RGS Pendentes
                    </h3>
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{summary.rgs.count}</span>
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
              {summary.trial.count > 0 && (
                <div className="pb-2">
                  <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-2 flex items-center justify-between z-10 border-b">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-blue-500" /> Fim de Experiência
                    </h3>
                    <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{summary.trial.count}</span>
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
