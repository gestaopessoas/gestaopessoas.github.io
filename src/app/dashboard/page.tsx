"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Users, Briefcase, Cake, CalendarDays, ArrowRight, UserPlus, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { differenceInDays, parseISO, isValid } from "date-fns";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState({
    headcount: 0,
    openJobs: 0,
    birthdays: 0,
    probation: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      const supabase = createClient();
      
      const [empRes, jobsRes] = await Promise.all([
        supabase.from("employees").select("id, status, birthday, admission_date").in("status", ["Ativo", "Férias", "Afastado"]),
        supabase.from("job_requests").select("id", { count: "exact", head: true }).neq("status", "Recusada").neq("status", "Arquivada")
      ]);

      const employees = empRes.data || [];
      const activeEmployees = employees; // já filtrado no banco
      
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      let birthdaysThisMonth = 0;
      let inProbation = 0;

      activeEmployees.forEach(e => {
        // Birthday check
        if (e.birthday) {
          const dateStr = e.birthday;
          let month = -1;
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length >= 2) month = parseInt(parts[1], 10) - 1;
          } else {
            const date = parseISO(dateStr);
            if (isValid(date)) month = date.getMonth();
          }
          if (month === currentMonth) birthdaysThisMonth++;
        }

        // Probation check (within 90 days)
        if (e.admission_date) {
          const dateStr = e.admission_date;
          let adDate: Date | null = null;
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) adDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
          } else {
            const d = parseISO(dateStr);
            if (isValid(d)) adDate = d;
          }

          if (adDate) {
            const diff = differenceInDays(new Date(), adDate);
            if (diff >= 0 && diff <= 90) inProbation++;
          }
        }
      });

      setMetrics({
        headcount: activeEmployees.length,
        openJobs: jobsRes.count || 0,
        birthdays: birthdaysThisMonth,
        probation: inProbation
      });
      setLoading(false);
    }
    loadMetrics();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Olá, bem-vindo de volta! 👋</h1>
        <p className="text-muted-foreground">Aqui está o resumo do que está acontecendo hoje.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Headcount Ativo</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : metrics.headcount}</div>
            <p className="text-xs text-muted-foreground mt-1">Colaboradores ativos e afastados</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vagas Abertas</CardTitle>
            <Briefcase className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : metrics.openJobs}</div>
            <p className="text-xs text-muted-foreground mt-1">Processos seletivos em andamento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Aniversariantes</CardTitle>
            <Cake className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : metrics.birthdays}</div>
            <p className="text-xs text-muted-foreground mt-1">Neste mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Em Experiência</CardTitle>
            <CalendarDays className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : metrics.probation}</div>
            <p className="text-xs text-muted-foreground mt-1">Dentro dos primeiros 90 dias</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Button variant="outline" className="justify-start h-12" onClick={() => window.location.href = "/dashboard/colaboradores"}>
              <UserPlus className="mr-2 h-4 w-4" />
              Gerenciar Colaboradores
            </Button>
            <Button variant="outline" className="justify-start h-12" onClick={() => window.location.href = "/dashboard/vagas"}>
              <Briefcase className="mr-2 h-4 w-4" />
              Visualizar Vagas
            </Button>
            <Button variant="outline" className="justify-start h-12" onClick={() => window.location.href = "/dashboard/analytics"}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Relatórios e Analytics
            </Button>
          </CardContent>
        </Card>

        <Card className="col-span-1 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <CardTitle>O que precisa de atenção?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {!loading && metrics.probation > 0 && (
                <div className="flex items-start gap-4 rounded-lg bg-background p-4 shadow-sm border">
                  <div className="rounded-full bg-amber-100 p-2 text-amber-600">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">Avaliações de Experiência</p>
                    <p className="text-sm text-muted-foreground">Existem {metrics.probation} colaboradores no período de experiência.</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => window.location.href = "/dashboard/colaboradores?tab=experiencia"}>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              {!loading && metrics.birthdays > 0 && (
                <div className="flex items-start gap-4 rounded-lg bg-background p-4 shadow-sm border">
                  <div className="rounded-full bg-pink-100 p-2 text-pink-600">
                    <Cake className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">Aniversariantes do Mês</p>
                    <p className="text-sm text-muted-foreground">{metrics.birthdays} colaboradores fazem aniversário neste mês.</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => window.location.href = "/dashboard/colaboradores?tab=aniversarios"}>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              {loading && <p className="text-sm text-muted-foreground">Carregando pendências...</p>}
              {!loading && metrics.probation === 0 && metrics.birthdays === 0 && (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground">Tudo tranquilo por aqui! 🎉</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
