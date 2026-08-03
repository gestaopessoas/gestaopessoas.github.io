"use client"

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { UserProfile } from "@/components/layout/UserProfile";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { Search, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { cn } from "@/lib/utils";

const breadcrumbMap: Record<string, string> = {
  "/dashboard": "Visão Geral",
  "/dashboard/formularios": "Formulários",
  "/dashboard/vagas": "Vagas",
  "/dashboard/entrevistas": "Entrevistas",
  "/dashboard/talentos": "Talentos",
  "/dashboard/admissao": "Admissão",
  "/dashboard/ponto": "Ponto",
  "/dashboard/ferias": "Férias",
  "/dashboard/holerites": "Holerites",
  "/dashboard/arquivo-morto": "Arquivo Morto",
  "/dashboard/rgs": "Controle RGS",
  "/dashboard/colaboradores": "Colaboradores",
  "/dashboard/onboarding": "Integração",
  "/dashboard/treinamentos": "Treinamentos",
  "/dashboard/avaliacoes": "Avaliações",
  "/dashboard/metas": "Metas",
  "/dashboard/pdi": "PDI",
  "/dashboard/competencias": "Competências",
  "/dashboard/turnover": "Turnover",
  "/dashboard/clima": "Clima",
  "/dashboard/beneficios": "Benefícios",
  "/dashboard/tipos-beneficios": "Tipos de Benefício",
  "/dashboard/armarios": "Armários",
  "/dashboard/mesas": "Mesas & Ilhas",
  "/dashboard/uniformes": "Uniformes & EPIs",
  "/dashboard/centros-de-custo": "Centros de Custo",
  "/dashboard/departamentos": "Departamentos",
  "/dashboard/cargos": "Cargos",
  "/dashboard/empresas": "Empresas",
  "/dashboard/obras": "Obras",
  "/dashboard/financeiro": "Resumo Financeiro",
  "/dashboard/analytics": "Analytics",
  "/dashboard/configuracoes": "Configurações",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  const breadcrumb = useMemo(() => {
    if (breadcrumbMap[pathname]) return breadcrumbMap[pathname];
    const parts = pathname.split("/");
    const lastPart = parts[parts.length - 1];
    if (!lastPart) return "Dashboard";
    return lastPart.charAt(0).toUpperCase() + lastPart.slice(1).replace(/-/g, " ");
  }, [pathname]);

  // ponytail: client-side guard only (UX/defense-in-depth). Static export has no
  // middleware in production, so the real barrier is Supabase RLS on the tables.
  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else setChecking(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => sub.subscription.unsubscribe();
  }, [router]);

  // Sidebar collapse: estado elevado do Sidebar para o layout (fix QA §0/C1).
  // isCollapsed = preferência persistida (desktop). Em <768px o Sidebar deriva
  // colapsado via isMobile, então o padding nunca deixa a sidebar cobrir conteúdo.
  const [isCollapsed, setIsCollapsed] = useState(false)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const saved = localStorage.getItem("sidebar-collapsed")
      if (saved !== null) {
        const v = JSON.parse(saved)
        if (typeof v === "boolean") setIsCollapsed(v)
      }
    } catch {
      // storage corrompido -> mantém default expandido
    }
  }, [])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    localStorage.setItem("sidebar-collapsed", JSON.stringify(isCollapsed))
  }, [isCollapsed])

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PermissionsProvider>
      <div className="flex h-screen overflow-hidden bg-background print:h-auto print:block print:bg-transparent">
        {/* Sidebar - fixed on desktop */}
        <Sidebar collapsed={isCollapsed} onToggle={() => setIsCollapsed((c) => !c)} />

        {/* Main Content Area - padding acompanha o estado real da sidebar (fix C1) */}
        <div
          className={cn(
            "flex flex-1 flex-col overflow-hidden print:overflow-visible print:block",
            isCollapsed ? "pl-[72px]" : "pl-[72px] md:pl-64"
          )}
        >
          {/* Sticky Header */}
          <header className="print:hidden sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b bg-background/95 px-6 backdrop-blur">
            {/* Breadcrumbs Placeholder */}
            <div className="flex items-center">
              <span className="text-sm font-medium text-muted-foreground">
                {breadcrumb}
              </span>
            </div>

            {/* Right Header actions */}
            <div className="flex items-center gap-4">
              <GlobalSearch />
              <NotificationBell />
              <UserProfile />
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-auto bg-muted/10 p-6 print:overflow-visible print:bg-transparent print:p-0">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </PermissionsProvider>
  );
}
